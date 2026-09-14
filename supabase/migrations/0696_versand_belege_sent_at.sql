-- 0696_versand_belege_sent_at.sql — Versandzeitpunkt an Rechnung und Angebot
--
-- WARUM: `invoices.status` kennt seit 0023 den Wert `sent`, aber KEINE Spalte,
-- die sagt, WANN der Beleg rausging — und `quotes` ebenso. Der Bereich
-- »versand« setzt nach erfolgreichem Mailversand `status='sent'` (nur aus
-- draft/finalized heraus, und nur an Belegen mit vergebener Nummer — ein
-- Entwurf ohne Nummer darf nicht als ausgestellt gelten, siehe
-- BuchhaltungService.update_invoice_raw) und trägt hier den Zeitpunkt ein.
--
-- `sent_at` ist UNSERE Handlung (unser Mailversand), kein fremdes Ereignis —
-- die eigene Uhr ist hier deshalb richtig (Wurzel 5b gilt für Fremdereignisse).
-- Der Kanal steht am Protokoll (`document_sends`, 0694), nicht hier.

alter table public.invoices
    add column if not exists sent_at timestamptz;

alter table public.quotes
    add column if not exists sent_at timestamptz;

comment on column public.invoices.sent_at is
    'Zeitpunkt des ersten erfolgreichen Belegversands (document_sends, 0694). NULL = nie versendet.';
comment on column public.quotes.sent_at is
    'Zeitpunkt des ersten erfolgreichen Belegversands (document_sends, 0694). NULL = nie versendet.';
