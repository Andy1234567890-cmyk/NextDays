-- Marktplatz heißt jetzt myBestDays.
--
-- Der eigene Marktplatz (plattform/, gastgeber/, mobile) firmiert ab sofort als
-- „myBestDays"; „myNextDays" bleibt der Name des PMS/Channel-Managers. Der
-- Herkunftsname einer Buchung steht als FREITEXT in reservations.ota_name und
-- wird an mehreren Stellen angezeigt (Kalender-Legende, Posteingang, Portal-
-- Aufschlüsselung) sowie in message_automation.channels als Filterwert
-- verglichen (case-insensitiver Textvergleich, inbox/service.py
-- `_automation_matches`).
--
-- Ohne diese Migration liefe der Bestand auseinander: die Buchungs-Engine
-- schreibt ab sofort 'myBestDays', während Altbuchungen 'myNextDays' tragen —
-- dieselbe Herkunft stünde dann unter zwei Namen in Legende und Filter, und
-- jede Automail-Regel mit Kanalfilter 'myNextDays' würde für neue Buchungen
-- stumm nicht mehr greifen.
--
-- Der KANAL (reservations.channel = 'portal') bleibt unverändert; er trägt die
-- Provisionslogik (Preisliste §2) und ist nicht vom Markennamen abhängig.

update public.reservations
   set ota_name = 'myBestDays'
 where ota_name = 'myNextDays';

update public.message_automation
   set channels = array_replace(channels, 'myNextDays', 'myBestDays')
 where channels is not null
   and 'myNextDays' = any (channels);

comment on column public.reservations.channel is
  'Vertriebskanal der Buchung. Bestimmt die Provision (Preisliste §2): '
  'portal = eigener myBestDays-Marktplatz (8 % all-in, Zahlung über die '
  'Plattform), direct = eigene Buchungsstrecke des Betriebs '
  '(provisionsfrei, Direct Charge), booking/airbnb/vrbo = OTA '
  '(1 % monatlich fakturiert, keine Zahlung über uns).';
