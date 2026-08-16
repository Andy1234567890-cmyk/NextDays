-- 0398 — Buchungszeitpunkt für Direktbuchungen nachtragen
--
-- `reservations.booked_at` kam mit 0291/0292 für die OTA-Nachpflege. Der
-- Schreibpfad für manuell angelegte Buchungen setzte die Spalte nie, weshalb
-- live JEDE Direktbuchung ohne Zeitpunkt dastand (36 von 36) — während Airbnb
-- (171/171) und Booking (68/68) lückenlos einen tragen. Jede Sortierung „nach
-- Eingang" ließ diese Buchungen damit hinten runterfallen.
--
-- Warum `created_at` hier KEIN Wurzel-5b-Verstoß ist: Wurzel 5b verbietet, die
-- eigene Uhr als Zeitpunkt eines FREMDEN Ereignisses auszugeben — bei einer
-- Airbnb-Buchung beschreibt `created_at` nur, wann der Feed sie zu uns brachte.
-- Eine Direktbuchung dagegen ENTSTEHT bei uns: der Mitarbeiter nimmt sie am
-- Telefon auf und legt sie an, unsere Uhr ist der Vorgang selbst. Dieselbe
-- Begründung trägt bereits `booking_engine/service.py` für den eigenen
-- Marktplatz.
--
-- Streng auf `channel = 'direct'` begrenzt: nur dort ist `created_at`
-- beweisbar unsere eigene Anlage. Kein Kanal, der von außen kommt, wird
-- angefasst — sonst entstünde genau die plausible Falschaussage, die 5b meint.
-- `booked_at is null` hält den Lauf idempotent (Wurzel 2) und schützt bereits
-- gepflegte Werte.

update public.reservations
   set booked_at = created_at
 where channel = 'direct'
   and booked_at is null;
