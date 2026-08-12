-- Eigener Kanal für Buchungen über die EIGENE WEBSITE des Betriebs.
--
-- PROBLEM: Es gab nur 'direct'. Der bedeutet in der Oberfläche „Direkt" und
-- fasst alles zusammen, was nicht über ein Portal kam — Telefon, E-Mail,
-- Laufkundschaft UND die eigene Website. Damit war die Frage „was bringt meine
-- Website?" nicht beantwortbar: die Buchung stand in derselben Zeile wie ein
-- Anruf.
--
-- Aufgefallen bei der Übernahme des Bestands einer Kundin (AirSmil, 12.08.2026):
-- Von 222 aktiven Buchungen kamen 9 nachweislich über ihre Buchungsstrecke
-- (Herkunft ist am Datensatz belegt), der Rest über Booking.com. Diese 9 sind
-- provisionsfreier Direktumsatz — genau die Zahl, die ein Betrieb sehen will.
-- Als 'direct' importiert wären sie mit Telefonbuchungen verschmolzen und
-- nachträglich nicht mehr trennbar gewesen (die Herkunft steht nur im
-- Quellsystem, nicht bei uns).
--
-- LÖSUNG: 'website' als eigener Kanal neben 'direct'.
--
-- ABGRENZUNG — wichtig, damit der Wert nicht verwässert:
--   * 'website'  = Gast hat auf der Website des BETRIEBS selbst gebucht
--                  (eigene Buchungsstrecke). Provisionsfrei.
--   * 'direct'   = Telefon, E-Mail, vor Ort, manuell erfasst. Provisionsfrei.
--   * 'portal'   = unser Marktplatz myBestDays. Provisionspflichtig (8 %).
--   * booking/airbnb/vrbo/ota_other = externe Portale. Provisionspflichtig.
--
-- KEINE Provisionsfolge: 'website' wird NICHT in die Mengen der
-- provisionspflichtigen Kanäle aufgenommen (payments/service.py,
-- subscriptions/service.py). Eine Buchung über die eigene Website des Betriebs
-- läuft nicht über uns und trägt deshalb keine Provision — sie wie einen
-- externen Kanal zu behandeln, wäre eine Falschabrechnung zulasten der Kundin.

alter type public.reservation_channel add value if not exists 'website';

-- `availability_source` trägt dieselben Kanalwerte für die Kalender-Belegung.
-- Fehlt der Wert dort, zerlegt die erste Website-Buchung die Kalender-Antwort
-- an der Pydantic-Validierung (so geschehen mit 'ical', siehe 0253) — der
-- Kalender wäre für das ganze Objekt tot, nicht nur für diese eine Buchung.
alter type public.availability_source add value if not exists 'website';

-- KEINE Bestandskorrektur hier: Anders als bei 0222/0223 gibt es keine Zeilen,
-- die nachweislich falsch liegen. Vorhandene 'direct'-Buchungen pauschal auf
-- 'website' zu heben, wäre geraten — bei einer Telefonbuchung wäre es schlicht
-- falsch (Wurzel 4). Die Herkunft ist im Bestand nicht gespeichert; sie kommt
-- ausschließlich beim Import aus dem Quellsystem mit.
--
-- Ein neuer Enum-Wert ist in DERSELBEN Transaktion nicht verwendbar (Postgres):
-- jede Zuweisung von 'website' gehört in eine spätere Migration oder in den
-- Anwendungscode nach dem Commit dieser Datei (Lehre aus 0222/0223).
