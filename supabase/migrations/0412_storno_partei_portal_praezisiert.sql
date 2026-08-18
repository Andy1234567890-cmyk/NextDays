-- 0412 — Was `cancelled_by_party = 'portal'` wirklich aussagt
--
-- DER ANLASS: 0410 legte den Wert `portal` an und beschrieb ihn als „Das
-- Portal/OTA hat storniert". Das ist zu stark. Beim Nachziehen eines
-- OTA-Fremdstornos (channel_manager/bookings_sync.py) meldet der Feed von
-- Booking.com/Airbnb ausschliesslich `status = "cancelled"` — er nennt NICHT,
-- ob der Gast oder der Gastgeber storniert hat. Diese Auskunft gibt es dort
-- nicht, und der Aggregator liefert sie auch nicht nach.
--
-- WAS `portal` DAHER HEISST: „Der Storno kam über das Portal zu uns." Nicht:
-- „das Portal-Unternehmen hat entschieden", und schon gar nicht „niemanden
-- trifft ein Verschulden". Wer aus dem Wert eine Schuldfrage ableitet, leitet
-- sie aus einer Information ab, die im Feed nicht steht (Wurzel 4).
--
-- WARUM DER WERT TROTZDEM GESETZT WIRD und nicht `null` bleibt: `null` heisst
-- „nicht erfasst" und gilt für die Stornos aus der Zeit vor 0410. Ein laufender
-- OTA-Storno IST erfasst — wir wissen, woher er kam. Beides gleich zu
-- schreiben, machte den einen Fall vom anderen ununterscheidbar; genau diese
-- Ununterscheidbarkeit war der Anlass für 0410.
--
-- FOLGE FÜR DAS REGELWERK (Provisionsentscheid): `portal` darf dort NICHT
-- automatisch als „Provision zurück" gelten. Praktisch stellt sich die Frage
-- nicht — die 8 % hängen an `channel = 'portal'` (myBestDays), OTA-Buchungen
-- tragen keine `platform_fees`-Zeile. Ein Regelwerk, das `portal` als
-- verschuldensfrei behandelt, wäre aber auf dem falschen Weg dorthin.
--
-- Nur Kommentare — kein DDL an Daten, keine Grants, keine Policies.

comment on column public.reservations.cancelled_by_party is
    'Wessen Sphäre den Storno ausgelöst hat. NULL = vor 0410 storniert, also '
    'nicht erfasst — NIE als "unbekannt" oder als Gast-Storno deuten. '
    'portal = der Storno kam über das Portal zu uns (OTA-Feed); der Feed nennt '
    'den Auslöser nicht, also ist daraus KEINE Schuldfrage ableitbar.';

comment on column public.reservation_cancellation_log.cancelled_by_party is
    'Partei DIESES Storno-Vorgangs (der Datensatz an reservations trägt nur '
    'den letzten). NULL = Zeile aus der Zeit vor 0410. Zur Bedeutung von '
    'portal siehe reservations.cancelled_by_party.';
