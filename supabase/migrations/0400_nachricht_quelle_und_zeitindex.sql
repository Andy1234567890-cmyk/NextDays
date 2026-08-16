-- 0400 — Woher eine Nachricht kam, und ein Index für die Zeitraum-Kennzahlen
--
-- ANLASS: Die Startseite bekommt eine Nachrichten-Sektion (gesendet, empfangen,
-- je Tag, per Automation). Vier der fünf Zahlen sind aus `portal_messages`
-- berechenbar — die fünfte NICHT: eine Automail und eine handgeschriebene
-- Nachricht sind in der Tabelle nicht unterscheidbar. Beide laufen durch
-- dieselbe `InboxService.send_message` (der Automail-Dispatch in
-- `inbox/planung.py` ruft sie unverändert auf), und das Portal-Echo trägt für
-- beide `sender = 'property'` zurück.
--
-- WARUM NICHT ÜBER `automation_scheduled_message` GEZÄHLT WIRD: Diese Tabelle
-- trägt UNIQUE (automation_id, thread_id) — pro Automation und Thread gibt es
-- HÖCHSTENS EINE Zeile, eine Neuplanung überschreibt die alte. Sie ist damit
-- ein Momentzustand, keine Versandhistorie; „3 Nachrichten per Automation in
-- 30 Tagen" wäre daraus eine plausible, aber falsche Zahl (Wurzel 4). Zudem
-- gibt es dort nur `send_at` (geplant) und `updated_at` (letzte Änderung
-- beliebiger Art), keinen Versandzeitpunkt.
--
-- Deshalb die Wahrheit dort hinschreiben, wo sie hingehört: an die Nachricht.

alter table public.portal_messages
    add column if not exists quelle text not null default 'manuell';

-- Geschlossene Menge, aber als CHECK statt Enum — dieselbe Begründung wie bei
-- `sender` in 0293: neue Quellen sollen ohne Typ-Migration dazukommen können.
--   manuell   = ein Mensch hat sie im Posteingang geschrieben
--   automation= eine Nachrichten-Automation hat sie ausgelöst
--   system    = von uns erzeugt (Statusmeldung), kein Absender im Betrieb
--   portal    = eingegangen; kam vom Gast bzw. vom Portal zu uns
alter table public.portal_messages
    drop constraint if exists portal_messages_quelle_check;

alter table public.portal_messages
    add constraint portal_messages_quelle_check
    check (quelle in ('manuell', 'automation', 'system', 'portal'));

comment on column public.portal_messages.quelle is
    'Wer die Nachricht ausgeloest hat: manuell | automation | system | portal '
    '(0400). NICHT die Richtung — die steht in `sender`. Der Default '
    '''manuell'' beschreibt den Bestand ehrlich: fuer Altzeilen ist die '
    'Quelle unbekannt, und ''automation'' zu raten waere eine Falschaussage. '
    'Die Kennzahl auf der Startseite zaehlt daher erst ab Einfuehrung.';

-- Der Zeitraum-Filter der Kennzahlen läuft über `sent_at` (den Zeitpunkt BEIM
-- PORTAL, Wurzel 5b) — dafür gab es keinen Index: vorhanden waren nur
-- (tenant_id, thread_ref, sent_at) und (tenant_id, booking_ref). Ein
-- „letzte 30 Tage über alle Threads" traf keinen davon und lief als Seq Scan
-- über den gesamten Nachrichtenbestand des Mandanten.
create index if not exists portal_messages_tenant_sent_idx
    on public.portal_messages (tenant_id, sent_at desc);
