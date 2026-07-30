-- Live-Chat zwischen Betrieb (web-Dashboard) und Betreiber-Team (/admin).
--
-- Kein neues Datenmodell: ein Chat IST eine Konversation im vorhandenen
-- support_tickets/support_messages-Modell (0204–0206). Genau so machen es die
-- Referenzen — Intercom („conversation parts"), Chatwoot und Chaskiq führen
-- Widget-Chat, E-Mail und Formular-Ticket in EINEM Konversations-Stream. Eine
-- zweite Chat-Tabelle daneben würde Verlauf, Zuweisung, Status und Realtime
-- doppeln und beide Seiten auseinanderlaufen lassen.
--
-- Ergänzt werden nur die Felder, die ein Chat braucht und ein Formular-Ticket
-- nicht hat:
--   • Herkunft (Widget-Chat vs. Formular) für die Agenten-Ansicht,
--   • Lese-Cursor je Seite (Chatwoot-Muster: contact_last_seen_at /
--     agent_last_seen_at — KEINE read_receipts-Tabelle, es sind genau zwei
--     Parteien),
--   • Vorschau der letzten Nachricht für Liste/Badge ohne Zweitabfrage,
--   • client_msg_id als Idempotenz-Backstop (Wurzel 2),
--   • Bewertung beim Schließen (Intercom Conversation Rating).

-- --- Konversation ------------------------------------------------------------
alter table public.support_tickets
    -- 'form' = Formular-Anfrage (gastgeber/support), 'chat' = Widget-Chat.
    add column if not exists source text not null default 'form',
    -- Lese-Cursor beider Seiten. Ungelesen = Nachrichten der GEGENSEITE, die
    -- jünger sind als der eigene Cursor.
    add column if not exists reporter_last_read_at timestamptz,
    add column if not exists agent_last_read_at timestamptz,
    -- Vorschau der letzten SICHTBAREN Nachricht. Interne Notizen dürfen hier
    -- NIE landen: die Spalte ist über die Melder-Policy (0205) mitlesbar.
    add column if not exists last_message_preview text,
    add column if not exists last_message_kind text,
    -- Zufriedenheit beim Schließen (1–5). Freiwillig, vom Melder gesetzt.
    add column if not exists rating smallint,
    add column if not exists rating_comment text,
    add column if not exists rated_at timestamptz;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'support_tickets_source_check'
    ) then
        alter table public.support_tickets
            add constraint support_tickets_source_check
            check (source in ('form', 'chat'));
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'support_tickets_last_message_kind_check'
    ) then
        alter table public.support_tickets
            add constraint support_tickets_last_message_kind_check
            check (last_message_kind is null
                   or last_message_kind in ('reporter', 'agent'));
    end if;
    if not exists (
        select 1 from pg_constraint where conname = 'support_tickets_rating_check'
    ) then
        alter table public.support_tickets
            add constraint support_tickets_rating_check
            check (rating is null or rating between 1 and 5);
    end if;
end $$;

comment on column public.support_tickets.last_message_preview is
    'Vorschau der letzten SICHTBAREN Nachricht. Interne Notizen nie hier '
    'ablegen — der Melder liest die Spalte per RLS (0205) mit.';

-- --- Nachrichten -------------------------------------------------------------
-- client_msg_id: vom Client erzeugte UUID. Doppelklick, Retry nach Timeout und
-- Reconnect senden dieselbe Nachricht erneut — der UNIQUE-Index ist der
-- Backstop, der Service reicht bei 23505 die bestehende Zeile zurück (Wurzel 2).
alter table public.support_messages
    add column if not exists client_msg_id text;

create unique index if not exists support_messages_client_msg_uq
    on public.support_messages (ticket_id, client_msg_id)
    where client_msg_id is not null;

-- --- Realtime-Autorisierung für Tippt-Anzeige und Anwesenheit ----------------
-- Nachrichten selbst laufen weiter über postgres_changes (0205/0206) — dort
-- entscheidet die RLS der Tabelle. Tippt-Anzeige und „Team ist online" sind
-- FLÜCHTIG und dürfen keine DB-Schreiblast erzeugen; dafür sind Supabase
-- Broadcast/Presence da. Deren Zugriff wird über RLS auf realtime.messages
-- geregelt (Realtime Authorization) — die Kanäle laufen als `private: true`,
-- ohne Policy ist alles dicht (Standard: deny).
--
-- Zwei Topics:
--   support:<ticket_id> — Tippt-Anzeige der Konversation. Teilnehmer sind der
--                         Melder, seine Kollegen im selben Betrieb und das
--                         Betreiber-Team.
--   support:presence    — „Ist gerade jemand vom Team da?". JEDER angemeldete
--                         Nutzer darf zuhören, aber NUR ein Plattform-Admin
--                         darf sich eintragen (sonst könnte sich ein Kunde
--                         selbst als Agent ausgeben).

create or replace function public.support_topic_teilnehmer(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.support_tickets t
        where 'support:' || t.id::text = topic
          and (
              t.reporter_user_id = (select auth.uid())
              or (
                  t.tenant_id is not null
                  and t.tenant_id = public.current_tenant_id()
              )
          )
    )
$$;

comment on function public.support_topic_teilnehmer(text) is
    'True, wenn der aktuelle Nutzer Teilnehmer der Konversation hinter dem '
    'Realtime-Topic support:<ticket_id> ist. SECURITY DEFINER, weil '
    'support_tickets für die Melder-Policy sonst pro Zeile erneut geprüft '
    'würde. Gibt nur einen Boolean zurück, nie Daten. Fail-closed.';

drop policy if exists support_realtime_lesen on realtime.messages;
create policy support_realtime_lesen on realtime.messages
    as permissive for select to authenticated
    using (
        realtime.messages.extension in ('broadcast', 'presence')
        and (
            (select realtime.topic()) = 'support:presence'
            or public.is_platform_admin()
            or public.support_topic_teilnehmer((select realtime.topic()))
        )
    );

drop policy if exists support_realtime_schreiben on realtime.messages;
create policy support_realtime_schreiben on realtime.messages
    as permissive for insert to authenticated
    with check (
        realtime.messages.extension in ('broadcast', 'presence')
        and (
            case
                -- Anwesenheit meldet NUR das Betreiber-Team.
                when (select realtime.topic()) = 'support:presence'
                    then public.is_platform_admin()
                else public.is_platform_admin()
                     or public.support_topic_teilnehmer((select realtime.topic()))
            end
        )
    );
