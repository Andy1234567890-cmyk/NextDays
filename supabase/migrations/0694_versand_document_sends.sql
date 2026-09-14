-- 0694_versand_document_sends.sql — Versand-Protokoll je Beleg (Bereich »versand«)
--
-- WARUM: Der Bestand rief `POST /email/send-document` (EmailSendModal) und
-- `POST /send-invoice-email` (EmailDialog) ins Leere — kein Backend, kein
-- Protokoll. Wer eine Rechnung per Mail verschickt hat, konnte das nirgends
-- nachlesen; ein Doppelklick hätte zwei Mails ausgelöst.
--
-- Hier bekommt JEDER Belegversand eine Zeile — VOR dem Versand als `pending`
-- angelegt (Claim), danach `sent` oder `failed`:
--
--   * Idempotenz (Wurzel 2): `inhalt_hash` = SHA-256 über Belegart, Beleg-ID,
--     Empfänger, Betreff, Text und Anhänge; `fenster` = Unix-Minute des
--     Aufrufs. Der Unique-Index (tenant_id, inhalt_hash, fenster) fängt den
--     gleichzeitigen Doppelklick auf DB-Ebene; das gleitende 60-s-Fenster
--     prüft der Service zusätzlich über `created_at`.
--   * `document_id` ist Text, nicht FK: Belegarten des Versand-Dialogs
--     (Lieferschein, Auftragsbestätigung, Vertrag, Quittung) haben nicht alle
--     eine Tabelle in diesem Schema; die Zugehörigkeit prüft der Service dort,
--     wo es eine gibt (invoices, quotes, reminders) per `load_scoped`.
--   * `status` deckungsgleich mit dem Pydantic-Literal in
--     apps/api/src/features/buchhaltung/bereiche/versand/schemas.py
--     (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
--   * `fehler` trägt die Meldung des Mailservers bei `failed` — die Oberfläche
--     zeigt sie im Verlauf, statt nur „fehlgeschlagen" zu sagen (Debugging).
--
-- Finanz-/Kundendaten sind server-only (Wurzel 6): RLS + revoke für
-- anon/authenticated, KEINE Realtime-Publikation.

create table if not exists public.document_sends (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    document_type       text not null
                        check (document_type in (
                            'invoice', 'quote', 'reminder', 'credit_note',
                            'delivery_note', 'order_confirmation', 'cancellation',
                            'contract', 'receipt', 'other'
                        )),
    document_id         text not null,
    document_number     text,
    kanal               text not null default 'email' check (kanal in ('email')),
    empfaenger          text[] not null,
    cc                  text[] not null default '{}',
    bcc                 text[] not null default '{}',
    betreff             text not null,
    text_vorschau       text,
    anhaenge            jsonb not null default '[]'::jsonb,
    inhalt_hash         text not null,
    fenster             bigint not null,
    status              text not null default 'pending'
                        check (status in ('pending', 'sent', 'failed')),
    message_id          text,
    fehler              text,
    sent_at             timestamptz,
    created_by          uuid,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint document_sends_idempotent unique (tenant_id, inhalt_hash, fenster)
);

create index if not exists document_sends_tenant_document_idx
    on public.document_sends (tenant_id, document_type, document_id, created_at desc);
create index if not exists document_sends_tenant_hash_idx
    on public.document_sends (tenant_id, inhalt_hash, created_at desc);
create index if not exists document_sends_tenant_created_idx
    on public.document_sends (tenant_id, created_at desc);

drop trigger if exists trg_document_sends_updated on public.document_sends;
create trigger trg_document_sends_updated
    before update on public.document_sends
    for each row execute function public.set_updated_at();

alter table public.document_sends enable row level security;

drop policy if exists document_sends_tenant on public.document_sends;
create policy document_sends_tenant on public.document_sends
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu — Empfänger-
-- adressen und Betreffzeilen sind Kunden-PII, nur der Server liest und schreibt.
revoke select, insert, update, delete on public.document_sends from anon, authenticated;
