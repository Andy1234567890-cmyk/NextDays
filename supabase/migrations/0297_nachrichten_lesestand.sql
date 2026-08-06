-- 0297 — Lesestand des Gastes je Thread (`channex_booking.guest_read_*`)
--
-- WAS DAS PORTAL LIEFERT (live gemessen am 06.08.2026, Thread 2606823815):
--
--   GET v2/threads/{id}  →  "last_message_reads": [
--     {"message_id": "32102299418", "user_id": "529591717", "created_at": "…T08:09:03Z"},
--     {"message_id": "32102535131", "user_id": "6776750",   "created_at": "…T08:13:03Z"}]
--
-- Das ist KEINE Liste gelesener Nachrichten, sondern EIN LESESTAND je Teilnehmer:
-- „dieser Nutzer war bis zu dieser Nachricht". Wer daraus eine Menge gelesener
-- IDs machte, hielte alles Ältere faelschlich für ungelesen — tatsächlich ist
-- alles bis zu diesem Zeitpunkt gelesen.
--
-- DESHALB ZWEI SPALTEN UND KEINE TABELLE: Ein Lesestand je Thread ist genau ein
-- Wertepaar (welche Nachricht, wann). Eine eigene Zeilen-Tabelle würde dieselbe
-- Information n-fach speichern und bei jeder Aktualisierung Altlasten
-- hinterlassen. Die HOST-Seite wird bewusst NICHT gespeichert: ob der Betrieb
-- selbst gelesen hat, weiß unser eigener Posteingang besser (`is_read`).
--
-- WARUM DER ZEITPUNKT ENTSCHEIDET: Zum Anzeigen des Häkchens vergleicht die
-- Oberfläche `sent_at <= guest_read_at`. Die `message_id` allein trüge das nicht
-- — sie ist eine Airbnb-ID, die in unseren gespiegelten Nachrichten nicht
-- durchgängig vorliegt (Channex vergibt eigene IDs). Der Zeitstempel gilt
-- kanalübergreifend; die ID bleibt als Beleg und für die Idempotenz daneben.
--
-- NULLABLE OHNE DEFAULT: Kein Lesestand bedeutet „das Portal meldet keinen"
-- (Booking.com/Expedia liefern so etwas nicht) — dann zeigt die Oberfläche gar
-- kein Häkchen, statt „ungelesen" zu behaupten (Wurzel 4).

alter table public.channex_booking
  add column if not exists guest_read_message_ref text,
  add column if not exists guest_read_at          timestamptz;

comment on column public.channex_booking.guest_read_message_ref is
  'ID der zuletzt vom GAST gelesenen Portal-Nachricht (Airbnb '
  'thread.last_message_reads[].message_id). Beleg + Idempotenz.';

comment on column public.channex_booking.guest_read_at is
  'Wann der Gast zuletzt gelesen hat — Zeitpunkt BEIM PORTAL, nie unsere Uhr '
  '(Wurzel 5b). NULL = der Kanal meldet keinen Lesestand; dann kein Haekchen.';
