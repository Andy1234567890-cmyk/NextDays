-- Herkunfts-ID für aus Lodgify übernommene Buchungen.
--
-- WARUM EINE EIGENE SPALTE UND NICHT `external_ref`:
-- `external_ref` ist im ganzen System der OTA-RESERVIERUNGSCODE. Er wird als
-- „Referenz" im Eigentümer-Reporting ausgegeben, im Posteingang und in der
-- Buchungsansicht. Trüge er eine Lodgify-ID, sähe der Eigentümer diese Nummer
-- als Portal-Code — eine Falschaussage der stillen Sorte, die niemand als Bug
-- erkennt, weil sie plausibel aussieht.
--
-- Dazu ein handfester Grund: Von den zu übernehmenden Buchungen sind die
-- meisten Booking.com-Buchungen MIT echtem Booking-Code. Der gehört in
-- `external_ref`. Bräuchte die Lodgify-ID dieselbe Spalte, ginge einer der
-- beiden Werte verloren — und damit die Zuordenbarkeit in genau der Richtung,
-- die man später braucht.
--
-- Mit eigener Spalte trägt eine Zeile beides:
--   external_ref        = Booking-/Airbnb-Code (Portal-Referenz, wie bisher)
--   lodgify_booking_id  = die Lodgify-Buchungs-ID (Herkunft der Übernahme)
--
-- IDEMPOTENZ (Wurzel 2): Der partielle Unique-Index ist der DB-seitige Riegel
-- gegen doppelte Anlage. Ein Import ist genau die Art Operation, die real
-- mehrfach läuft — abgebrochen und neu gestartet, zweimal parallel, oder Monate
-- später zum Nachziehen. Die Anwendung prüft vorher auf Vorhandensein, aber
-- verlassen darf man sich darauf nicht: prüfen und einfügen sind zwei Schritte,
-- und dazwischen passt ein zweiter Lauf. Der Index macht die zweite Zeile
-- unmöglich, nicht bloß unwahrscheinlich.
--
-- Partiell (`where ... is not null`), weil die überwältigende Mehrheit der
-- Buchungen nie aus Lodgify kam und dort NULL trägt — ein voller Unique-Index
-- über NULLs wäre in Postgres zwar erlaubt (NULLs kollidieren nicht), der
-- partielle Index ist aber kleiner und macht die Absicht explizit.

alter table public.reservations
    add column if not exists lodgify_booking_id text;

create unique index if not exists reservations_lodgify_booking_uidx
    on public.reservations (tenant_id, lodgify_booking_id)
    where lodgify_booking_id is not null;

comment on column public.reservations.lodgify_booking_id is
    'Buchungs-ID aus Lodgify bei uebernommenem Bestand. Getrennt von '
    'external_ref, das den OTA-Reservierungscode traegt (und bei denselben '
    'Zeilen gefuellt ist). Nur gesetzt, wenn die Buchung aus Lodgify kam; '
    'sonst NULL. Unique je Tenant — der DB-seitige Riegel gegen Doppelimport.';
