-- OTA-Buchungsdetails an der Buchung (Storno-Staffel, Notes, Konditionen)
--
-- WOZU: Channex liefert je Buchung deutlich mehr, als wir übernommen haben.
-- Live geprüft an BDC-5716807885 (Booking.com, 12.08.2026) — im Rohpayload
-- unter `rooms[0].meta` steht:
--   cancel_penalties: [{from: 2026-08-12T22:01:18, amount: 0.00},
--                      {from: 2027-06-25T22:00:00, amount: 4268.00}]
--   policies:  „Children and Extra Bed Policy … Deposit Policy … Cancellation …"
--   meal_plan: „No meal is included in this room rate."
--   price_details.guest_view.taxes: Resort fee 150,00 / Cleaning fee 955,00
-- und im Kopf `notes` mit „** THIS RESERVATION HAS BEEN PRE-PAID **",
-- „Payment Collect: OTA collect", „OTA Commission: 805.95".
--
-- Bisher landete davon nichts in `reservations`: die Detailansicht zeigte
-- deshalb UNSERE Buchungskondition — die für eine Booking-Buchung gar nicht
-- gilt. Wer dem Gast am Telefon sagt, bis wann er kostenfrei storniert, braucht
-- die Staffel DES PORTALS, nicht unsere.
--
-- WARUM DREI SPALTEN UND KEIN DUTZEND:
--   * `ota_cancel_penalties` eigen, weil sie angezeigt und rechtlich zugesagt
--     ist (und weil daraus der Buchungszeitpunkt ableitbar ist: die erste Stufe
--     beginnt im Buchungsmoment — Wurzel 5b, siehe `ota_buchungszeitpunkt`).
--   * `ota_notes` eigen, weil der Block dem Empfang direkt vorgelesen wird.
--   * `ota_details` als ein JSONB für das Beiwerk (Policies-Klartext,
--     Verpflegung, Rauchen, Kinder-Alter, Gast-Labels wie „Genius Booker",
--     RUID, Preis-Details). Eigene Spalten dafür wären ein Dutzend Felder, die
--     niemand filtert — und jedes neue Portal-Feld erzwänge eine Migration.
--
-- KEIN DATENVERLUST BISHER: der vollständige Payload liegt in
-- `channex_booking.raw`. Der Nachzieh-Lauf
-- `scripts/backfill_ota_buchungsdetails.py` füllt diese Spalten daraus, ohne
-- Channex erneut abzufragen.

alter table public.reservations
    add column if not exists ota_cancel_penalties jsonb,
    add column if not exists ota_notes text,
    add column if not exists ota_details jsonb;

comment on column public.reservations.ota_cancel_penalties is
    'Storno-Staffel des Portals als Liste [{from, amount, currency}] — die dem '
    'Gast zugesagte Regel. NULL = das Portal hat keine geliefert (NICHT '
    '„kostenfrei"). Die erste Stufe beginnt im Buchungsmoment und ist damit '
    'die verlässlichste Quelle für booked_at, wenn das Portal kein eigenes '
    'Buchungsdatum meldet.';

comment on column public.reservations.ota_notes is
    'Notes-Block des Portals im Klartext (Prepaid-Hinweis, Payment Collect, '
    'Provision, Sonderwünsche). NULL = nichts geliefert.';

comment on column public.reservations.ota_details is
    'Weitere Portal-Angaben als JSONB: policies, meal_plan, smoking, '
    'children_ages, guest_labels, ruid, price_details. Bewusst ein Feld statt '
    'eines Dutzends Spalten — Anzeigedaten, nach denen niemand filtert.';
