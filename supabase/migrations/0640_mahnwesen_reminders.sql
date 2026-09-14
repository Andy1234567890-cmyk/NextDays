-- 0640_mahnwesen_reminders.sql — Mahnungen (Bereich »mahnwesen« der Buchhaltung)
--
-- WARUM: Das alte Taskilo-Werkzeug hatte ein `reminders`-Repository, aber KEIN
-- `create table` (docs/buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md, „Altes
-- Datenmodell"). Die Fachlogik (drei Stufen, Gebühr, Nummer `M<Stufe>-…` aus der
-- Uhrzeit) steckte im Browser. Hier bekommt die Mahnung erstmals eine Tabelle —
-- und die Regeln wandern auf den Server:
--
--   * EINE Mahnung je Rechnung UND Stufe (unique tenant_id, invoice_id, level):
--     ein Doppelklick auf „Mahnung erstellen" legt keine zweite 1. Mahnung an
--     (Wurzel 2, DB-Backstop zusätzlich zur Service-Prüfung).
--   * Die Nummer kommt aus `next_document_number(tenant, 'reminder', 'MA-')`
--     (GoBD-lückenlos, nur serverseitig), unique je Tenant.
--   * `currency` ist NOT NULL OHNE Default: sie kommt aus der gemahnten Rechnung.
--     Fehlt sie dort, schlägt das Anlegen mit 422 fehl (Wurzel 4).
--   * `amount_open` ist der offene Rechnungsbetrag zum Mahnzeitpunkt
--     (gross_amount − paid_amount), `fee` die Mahngebühr der Stufe, `interest`
--     die bis zum Mahndatum aufgelaufenen Verzugszinsen zu `interest_rate` % p.a.
--     `amount_total` = amount_open + fee + interest. Alle Beträge sind
--     Zeitpunkt-Tatsachen und werden NICHT aus der Rechnung nachgerechnet —
--     eine versendete Mahnung ändert sich nicht mehr, auch wenn danach gezahlt
--     wird (der Status wird dann `paid`).
--   * `invoice_id … on delete restrict`: eine Mahnung existiert nur zu einer
--     ausgestellten Rechnung; die wird nie gelöscht. Ein Cascade würde ein
--     versendetes Schreiben stumm mitlöschen.
--
-- Status-Werte deckungsgleich mit dem Pydantic-Literal in
-- apps/api/src/features/buchhaltung/bereiche/mahnwesen/schemas.py
-- (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + revoke für anon/authenticated,
-- KEINE Realtime-Publikation.

create table if not exists public.reminders (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    reminder_number     text not null,
    invoice_id          uuid not null references public.invoices(id) on delete restrict,
    customer_id         uuid references public.customers(id) on delete set null,
    level               smallint not null check (level between 1 and 3),
    reminder_date       date not null,
    due_date            date not null,
    fee                 numeric(12,2) not null,
    interest            numeric(12,2) not null,
    interest_rate       numeric(5,2)  not null,
    amount_open         numeric(12,2) not null,
    amount_total        numeric(12,2) not null,
    currency            text not null,
    status              text not null default 'draft'
                        check (status in ('draft', 'sent', 'paid', 'cancelled')),
    sent_at             timestamptz,
    sent_message_id     text,
    text_header         text,
    text_footer         text,
    notes               text,
    -- Darstellungs-Einstellungen des Versand-Dialogs (Vorlage, Farbe, Logo,
    -- documentSettings) — er speichert sie per PATCH vor Druck/Versand, damit
    -- der Ausdruck später gleich aussieht. Reine Anzeige, keine Fachdaten.
    template_settings   jsonb not null default '{}'::jsonb,
    created_by          uuid,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint reminders_nummer_eindeutig unique (tenant_id, reminder_number),
    constraint reminders_stufe_je_rechnung unique (tenant_id, invoice_id, level)
);

create index if not exists reminders_tenant_status_idx
    on public.reminders (tenant_id, status);
create index if not exists reminders_tenant_invoice_idx
    on public.reminders (tenant_id, invoice_id);

drop trigger if exists trg_reminders_updated on public.reminders;
create trigger trg_reminders_updated
    before update on public.reminders
    for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;

drop policy if exists reminders_tenant on public.reminders;
create policy reminders_tenant on public.reminders
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu. Nur der
-- Server (service_role) liest und schreibt Mahnungen.
revoke select, insert, update, delete on public.reminders from anon, authenticated;
