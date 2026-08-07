-- 0305 — Nachrichteneingang: Spiegel wird geschrieben, Realtime bekommt ein Signal
--
-- DER ANLASS (07.08.2026): Der Posteingang zeigte eine Airbnb-Support-Nachricht
-- von 09:02 Uhr nicht an, obwohl sie seit 07:05 Uhr in `channex_webhook_event`
-- lag. Die Ursache war eine Kette aus drei Brüchen — 0293 hatte den Speicher
-- angelegt, aber niemand füllte ihn, und niemand meldete den Eingang:
--
--   1. Der Webhook WARF den Text weg: `message` stand in
--      `channels._UNPERSISTED_EVENTS`, also lief der Ingest an der Persistenz
--      vorbei. Übrig blieb nur der Trigger für die Abwesenheitsantwort.
--   2. Der EINZIGE Schreiber von `portal_messages` war `inbox.service`
--      `_spiegel_schreiben` — aufgerufen erst, wenn ein MENSCH den Thread
--      öffnet. Der in 0293 angekündigte „regelmäßige Abgleich" fehlte.
--      Messbar: alle 13 Zeilen trugen `created_at` von 05:15/05:16 (die Klicks
--      des Betriebs) bei `sent_at`-Werten von Mai bis August.
--   3. Die UI abonnierte `sandbox_message` — eine reine Test-Tabelle, die im
--      Produktivpfad nie geschrieben wird. Das Abo verband sauber (Tabelle
--      publiziert, Grant da, Status SUBSCRIBED) und bekam nie ein Event. Genau
--      die stumme Attrappe, vor der 0234 warnt: „die UI wirkt live,
--      aktualisiert aber nie."
--
-- WARUM DAS SIGNAL AN `channex_booking` HÄNGT UND NICHT AN `portal_messages`:
-- Der naheliegende Weg wäre, `portal_messages` zu publizieren und der UI ein
-- `select` zu geben. Das wäre ein Wurzel-6-Fehler: `body` enthält den
-- Gastnachrichten-KLARTEXT. Ein `grant select to authenticated` öffnet den
-- PostgREST-Direktpfad für JEDE Rolle mit gültigem JWT — auch für einen
-- cleaner, der per `curl /rest/v1/portal_messages` alle Verläufe des Mandanten
-- ausliest. Der Rollen-Datensplit sitzt im FastAPI-Layer und wäre dabei
-- umgangen.
--
-- Deshalb bleibt der Inhalt hinter der API, und Realtime bekommt nur die
-- inhaltsfreie Tatsache „in diesem Thread hat sich etwas getan":
-- `channex_booking.last_message_at`. Die Tabelle ist bereits publiziert (0042)
-- und trägt bereits den übrigen Thread-Zustand (`is_read`, `guest_read_at`,
-- `inbox_status`) — das Signal gehört fachlich genau dorthin. Die UI hört auf
-- das Signal und lädt den Inhalt über die API nach, die den Rollen-Split
-- durchsetzt.

-- Der Zeitpunkt der jüngsten Nachricht im Thread — das Realtime-Signal.
-- Bewusst OHNE Inhalt und ohne Absender: was jemand geschrieben hat, ist über
-- den Direktpfad nicht zu erfahren, nur DASS geschrieben wurde.
alter table public.channex_booking
  add column if not exists last_message_at timestamptz;

comment on column public.channex_booking.last_message_at is
  'Zeitpunkt der juengsten Nachricht im Thread — Realtime-Signal fuer den '
  'Posteingang (0305). Inhaltsfrei mit Absicht: der Nachrichtentext bleibt in '
  'portal_messages hinter der API, weil ein authenticated-SELECT darauf den '
  'Rollen-Split per PostgREST-Direktpfad umgehen wuerde (Wurzel 6). Traegt die '
  'Portal-Zeit der Nachricht, nie unsere Schreibzeit (Wurzel 5b).';

-- Vorbereitet, noch nicht genutzt: die Thread-Liste sortiert „letzte
-- Aktivität" derzeit im Dienst über `portal_messages` (`_last_messages`), weil
-- dort auch der Vorschautext herkommt. Sobald die Sortierung auf dieses Feld
-- umgestellt wird, wird daraus ein Index-Scan statt eines Sorts über alle
-- Buchungen des Mandanten. Bis dahin kostet der Index nur Schreibaufwand —
-- bewusst in Kauf genommen, damit die Umstellung keine zweite Migration
-- braucht; wer ihn vorher aufräumt, tut nichts Falsches.
create index if not exists channex_booking_last_message_idx
  on public.channex_booking (tenant_id, last_message_at desc)
  where last_message_at is not null;

-- Nachrichten ohne Buchungsbezug (Airbnb-Support, Anfragen VOR der Buchung)
-- kommen mit `booking_id: null`, hängen aber an einem `message_thread_id`.
-- 0293 hat `booking_ref` dafür schon nullable gemacht; `thread_ref` trug bisher
-- jedoch immer die BUCHUNGS-Zeile (channex_booking.id), weil nur der
-- UI-Schreibpfad existierte. Der Eingangspfad kennt diese Zeile nicht
-- zwangsläufig — er kennt den Portal-Thread. Dieses Feld hält ihn fest, damit
-- eine spaeter eintreffende Buchung ihre Vorgeschichte zuordnen kann.
alter table public.portal_messages
  add column if not exists portal_thread_ref text;

comment on column public.portal_messages.portal_thread_ref is
  'Die message_thread_id BEIM AGGREGATOR (0305). Getrennt von thread_ref, das '
  'die lokale Buchungszeile meint: eine Support-Nachricht oder eine Anfrage vor '
  'der Buchung hat einen Portal-Thread, aber (noch) keine Buchung.';

create index if not exists portal_messages_portal_thread_idx
  on public.portal_messages (tenant_id, portal_thread_ref, sent_at)
  where portal_thread_ref is not null;

-- WURZEL 6 — GEGENPROBE ZU DIESER MIGRATION
-- Was kann ein eingeloggter cleaner mit dem anon-Key per curl?
--   /rest/v1/portal_messages           → unveraendert kein Zugriff: die Tabelle
--     bekam nie ein authenticated-GRANT (0187 nahm neuen Tabellen das Default)
--     und ist NICHT in supabase_realtime. Diese Migration aendert daran
--     bewusst NICHTS.
--   /rest/v1/channex_booking           → wie bisher lesbar (Grant von vor 0187),
--     jetzt inklusive last_message_at. Das ist ein Zeitstempel ohne Inhalt und
--     verraet nichts, was die Buchungszeile nicht ohnehin zeigt.
-- Schreibend bleibt beides serverseitig: portal_messages hat den revoke aus
-- 0293, channex_booking wird ausschliesslich vom Service geschrieben.
