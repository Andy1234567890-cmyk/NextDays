-- 0391_airbnb_thread_id_merken.sql — Airbnb-Thread-ID an der Buchung speichern
--
-- DER BEFUND (13.08.2026, live gemessen): `sync_bookings_feed` brauchte ⌀55 s,
-- um „nichts zu tun" zu melden. Der Feed-Abruf selbst dauert 146 ms — die
-- restlichen 55 s gingen an EINEN Nachschlagevorgang:
--
--   lesestaende_aktualisieren → _thread_ids_des_kontos → nachpflege_bestand
--   → {"etappen": 24, "buchungen": 431}
--
-- Alle fünf Minuten wurde die komplette Airbnb-Historie über 24 Abrufe geholt,
-- nur um Bestätigungscode → Thread-ID abzubilden. Das Ergebnis über fünf Läufe
-- in Folge: `{"geprueft": 4, "gesetzt": 0}`.
--
-- Die Zuordnung ist praktisch unveränderlich: Eine Buchung behält ihren Thread.
-- Sie gehört deshalb an die Buchung, nicht in einen 24-Etappen-Rundflug je Tick.
--
-- Kein NOT NULL und kein Default: Bestandszeilen haben die ID noch nicht, und
-- ein erfundener Wert wäre schlimmer als keiner (Wurzel 4). Der Nachpflege-
-- Schritt füllt sie beim nächsten Bestandsabruf; bis dahin fehlt sie und der
-- alte Weg greift für genau diese Zeilen.
alter table public.channex_booking
    add column if not exists airbnb_thread_id text;

comment on column public.channex_booking.airbnb_thread_id is
    'Airbnb-Thread-ID dieser Buchung (aus dem Bestandsabruf gemerkt). NULL = '
    'noch nicht bekannt; dann wird sie beim nächsten Bestandsabruf nachgetragen. '
    'Channex reicht sie nicht durch, deshalb kommt sie von Airbnb selbst.';

-- Der Lesestand-Tick fragt „welche dieser Codes kennen wir schon?" — genau
-- dieser Zugriff, nichts anderes. Teilindex, weil nur gefüllte Zeilen gesucht
-- werden.
create index if not exists channex_booking_airbnb_thread_idx
    on public.channex_booking (ota_reservation_code)
    where airbnb_thread_id is not null;

-- RLS/Grants bleiben unverändert: die Spalte hängt an einer Tabelle, die für
-- anon/authenticated bereits geschlossen ist (0224). Eine Thread-ID ist zudem
-- kein Geheimnis, sondern eine Fremdschlüssel-artige Kennung — sie steht ohnehin
-- nur dem Server zur Verfügung.
