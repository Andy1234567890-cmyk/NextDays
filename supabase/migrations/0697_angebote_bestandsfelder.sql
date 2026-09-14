-- 0697_angebote_bestandsfelder.sql
-- Angebote (quotes) auf den Stand des übernommenen Taskilo-Angebotsflusses
-- bringen (docs/buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md, „Angebote,
-- Auftragsbestätigung … ~25 000 Zeilen fehlen"). Der Bestand (quoteService.ts,
-- QuoteDetailView, SendDocumentModal) liest und schreibt am Angebot Felder,
-- die 0024 nie angelegt hat:
--   * Workflow-Zeitpunkte  sent_at / accepted_at / rejected_at / cancelled_at
--     + rejection_reason — die Detailansicht zeigt „Versendet am …", der
--     Versand-Dialog setzt den Zeitpunkt.
--   * tags                 — frei vergebene Schlagworte in der Detailansicht.
--   * design (jsonb)       — Vorlage, Farbe, Logo-Größe, Seitenmodus und
--     documentSettings, die der Versand-Dialog VOR dem Druck speichert
--     (SendDocumentModal, „Template-Einstellungen speichern").
--   * title / customer_order_number — Betreff und Referenz des Kunden aus dem
--     Editor (bei Rechnungen längst Bestandsfelder).
-- Alles additiv und nullable; kein Default, der einen Wert erfindet (Wurzel 4).
alter table public.quotes
    add column if not exists sent_at               timestamptz,
    add column if not exists accepted_at           timestamptz,
    add column if not exists rejected_at           timestamptz,
    add column if not exists cancelled_at          timestamptz,
    add column if not exists rejection_reason      text,
    add column if not exists tags                  text[] not null default '{}',
    add column if not exists design                jsonb,
    add column if not exists title                 text,
    add column if not exists customer_order_number text;

-- Der Status-Katalog des Bestands kennt zusätzlich `cancelled`; der Kommentar
-- in 0024 nannte ihn nicht, ein CHECK gab es nie. Jetzt festhalten, was gilt.
alter table public.quotes drop constraint if exists quotes_status_chk;
alter table public.quotes add constraint quotes_status_chk check (
    status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled', 'converted')
);

comment on column public.quotes.design is
    'Vorlagen-Einstellungen des Belegs (template, color, logoUrl, logoSize, pageMode, documentSettings) — geschrieben vom Versand-Dialog, gelesen von Vorschau und PDF.';
