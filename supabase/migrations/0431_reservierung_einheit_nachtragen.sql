-- 0431 — `reservations.unit_id` für Buchungen ohne Einheit nachtragen.
--
-- BEFUND (24.08.2026, Live): Eine Website-Buchung ließ sich nicht verlängern.
-- Der Move wies mit „Ziel-Zeitraum enthält bereits belegte/gesperrte Tage" ab,
-- obwohl die Zieltage frei waren — die Buchung zählte ihre EIGENEN Nächte als
-- Fremdbelegung. Ursache: die Reservierung trug `unit_id = null`, ihre
-- `availability`-Zeilen dagegen die Einheit. Der Alt-Tag-Filter im Vorcheck
-- vergleicht Zeile↔Reservierung über die Einheit und traf deshalb nie.
--
-- Betroffen waren alle 10 `channel='website'`-Zeilen des Beta-Betriebs (jede
-- andere Buchung — direct/booking/airbnb/vrbo/portal — trug ihre Einheit). Sie
-- sind an `create_reservation_atomic` vorbei eingespielt worden; die RPC setzt
-- `unit_id` seit 0275 immer selbst.
--
-- Der Code-Fix (reservations/_base.py `_gehaltene_einheit`) leitet die Einheit
-- zur Laufzeit ab und heilt die Zeile beim nächsten Move. Diese Migration zieht
-- den Bestand EINMAL nach, damit die Zuordnung nicht bis zur nächsten Änderung
-- der jeweiligen Buchung offen bleibt — sie hängt an jeder Freigabe mit
-- (`_release_nights`, Wurzel 1).
--
-- NUR wo die Zuordnung EINDEUTIG ist:
--   * die Einheit ist an ALLEN Nächten der Buchung als `booked` geführt, und
--   * genau EINE Einheit des Objekts erfüllt das, und
--   * keine ANDERE aktive Buchung benennt diese Einheit in dem Zeitraum.
-- Alles andere bleibt leer. Eine geratene Einheit wäre keine Notlösung, sondern
-- eine Doppelbelegung (Wurzel 4/5: kein erfundener Ersatzwert, fail-closed).

with offen as (
    select r.id, r.property_id, r.check_in, r.check_out
      from public.reservations r
     where r.unit_id is null
       and r.status not in ('cancelled', 'declined', 'expired')
       and r.check_out > r.check_in
), kandidat as (
    select o.id,
           a.unit_id,
           count(*) as belegte_naechte,
           (o.check_out - o.check_in) as naechte
      from offen o
      join public.availability a
        on a.property_id = o.property_id
       and a.date >= o.check_in
       and a.date <  o.check_out
       and a.status = 'booked'
       and a.unit_id is not null
     group by o.id, a.unit_id, o.check_in, o.check_out
), voll as (
    -- Einheiten, die den GANZEN Aufenthalt halten.
    select id, unit_id from kandidat where belegte_naechte = naechte
), frei as (
    -- Davon die, die keine andere aktive Buchung im Zeitraum für sich beansprucht.
    select v.id, v.unit_id
      from voll v
      join offen o on o.id = v.id
     where not exists (
        select 1
          from public.reservations x
         where x.property_id = o.property_id
           and x.id <> o.id
           and x.unit_id = v.unit_id
           and x.status not in ('cancelled', 'declined', 'expired')
           and x.check_in < o.check_out
           and x.check_out > o.check_in
     )
), eindeutig as (
    -- `min(uuid)` gibt es in Postgres nicht — die eine Zeile kommt über
    -- `having count(*) = 1` und `bool_and`-freies min über den Text.
    select id, (min(unit_id::text))::uuid as unit_id
      from frei
     group by id
    having count(*) = 1
)
update public.reservations r
   set unit_id = e.unit_id
  from eindeutig e
 where r.id = e.id
   and r.unit_id is null;
