-- 0660_belege_belegarten_und_kette.sql — Belegarten und Belegkette (Bereich »belege«)
--
-- WARUM: Das alte Werkzeug hatte ACHT Beleg-Editoren als Kopien (Rechnung,
-- Angebot, Auftragsbestätigung, Lieferschein, Gutschrift, Storno, wieder-
-- kehrende Rechnung, Mahnung — docs/buchhaltung/TASKILO-FINANZ-BESTAND-
-- 2026-09-11.md, „Einen Editor portieren, nicht acht"). Hier wird KEINE neue
-- Tabelle erfunden: `invoices` (0023) trägt bereits `invoice_type` — der Kopf
-- kommentiert invoice|credit_note|storno, das Bestand-Dokument kennt zusätzlich
-- `recurring`. Ein CHECK dazu existierte bis heute NICHT: jede Zeichenkette war
-- als Belegart speicherbar. Das wird hier nachgezogen und um die zwei fehlenden
-- Arten der Kette ergänzt.
--
--   * `order_confirmation` (Auftragsbestätigung, Nummernkreis AB-) und
--     `delivery_note` (Lieferschein, LS-) — keine Steuerbelege, aber Glieder
--     der Kette Angebot → AB → Lieferschein → Rechnung → Gutschrift.
--   * `source_document_id`: der Beleg, aus dem dieser hervorging (AB aus
--     Angebot steht in `source_quote_id`, weil Angebote in `quotes` leben —
--     0024). `on delete set null`, damit ein gelöschter Entwurf die Kette
--     nicht mit sich reißt; festgeschriebene Belege werden nie gelöscht.
--   * Idempotenz der Umwandlung (Wurzel 2): je Quelle und Zielart höchstens
--     EIN aktiver Folgebeleg — ein Doppelklick auf „Umwandeln in Lieferschein"
--     legt keinen zweiten an. Der Service liest bei 23505 den vorhandenen
--     zurück. Mehrere Teil-Gutschriften zu einer Rechnung sind bewusst NICHT
--     vorgesehen: die Umwandlung übernimmt immer alle Positionen.
--
-- Check-Werte deckungsgleich mit `BELEGARTEN_INVOICES` in
-- apps/api/src/features/buchhaltung/bereiche/belege/schemas.py (Regel
-- „DB-CHECK und Pydantic-Literal deckungsgleich").
--
-- Der Constraint wird zuerst NOT VALID angelegt und dann validiert: enthält
-- der Bestand eine fremde Belegart, bricht die Migration LAUT ab (Wurzel 5),
-- statt still weiterzulaufen. Live-Prüfung vor dem Einspielen:
--   select invoice_type, count(*) from public.invoices group by 1;

alter table public.invoices
    add column if not exists source_document_id uuid
        references public.invoices(id) on delete set null,
    add column if not exists source_quote_id uuid
        references public.quotes(id) on delete set null;

alter table public.invoices
    drop constraint if exists invoices_invoice_type_check;
alter table public.invoices
    add constraint invoices_invoice_type_check
    check (invoice_type in (
        'invoice', 'credit_note', 'storno', 'recurring',
        'order_confirmation', 'delivery_note'
    )) not valid;
alter table public.invoices validate constraint invoices_invoice_type_check;

-- Ein Beleg entsteht aus GENAU einer Quelle (Angebot ODER Beleg), nie aus beiden.
alter table public.invoices
    drop constraint if exists invoices_eine_quelle_check;
alter table public.invoices
    add constraint invoices_eine_quelle_check
    check (source_document_id is null or source_quote_id is null);

create index if not exists invoices_source_document_idx
    on public.invoices (tenant_id, source_document_id)
    where source_document_id is not null;
create index if not exists invoices_source_quote_idx
    on public.invoices (tenant_id, source_quote_id)
    where source_quote_id is not null;
create index if not exists invoices_tenant_type_status_idx
    on public.invoices (tenant_id, invoice_type, status)
    where deleted_at is null;

-- Wurzel 2: je Quelle und Zielart ein aktiver Folgebeleg.
create unique index if not exists invoices_folgebeleg_je_quelle_uidx
    on public.invoices (source_document_id, invoice_type)
    where source_document_id is not null and deleted_at is null;
create unique index if not exists invoices_folgebeleg_je_angebot_uidx
    on public.invoices (source_quote_id, invoice_type)
    where source_quote_id is not null and deleted_at is null;
