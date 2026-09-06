-- 0572 — `tenants.enabled_modules`: Module, die ein Betrieb sehen darf.
--
-- ANLASS (06.09.2026, Betreiber): „Personal" und „Website-Baukasten" sollen
-- vorerst NUR AirSmil sehen, kein neuer Kunde. Beide Bereiche sind gebaut, aber
-- noch nicht so weit, dass sie an zahlende Betriebe gehen.
--
-- WARUM NICHT `is_internal` (0505): das kennzeichnet die drei Fotomodell-Konten
-- des Hauses (Seeblick, Alpenzeit, Nordlicht) und schaltet dort die unfertige
-- Buchhaltung frei. AirSmil ist gerade KEIN internes Konto, sondern der echte
-- Beta-Betrieb — live geprueft am 06.09.2026. Auf `is_internal` zu setzen waere
-- also genau falsch herum: die beiden Bereiche verschwaenden bei AirSmil und
-- erschienen ausgerechnet in den Vorfuehrkonten.
--
-- WARUM EINE LISTE statt je Modul einer Spalte: das naechste unfertige Modul
-- braucht dann keine Migration mehr, nur einen Eintrag. Genau dieser Fall ist
-- hier schon zweimal aufgetreten (Buchhaltung 0505, jetzt Personal + Baukasten).
--
-- Diese Spalte ist KEIN Sicherheitsmerkmal im Sinne von Mandantentrennung: sie
-- steuert die Sichtbarkeit unfertiger Bereiche, nicht den Zugriff auf fremde
-- Daten. Davor stehen unveraendert RLS und die Autorisierung der Endpunkte.
-- Sie ist aber auch KEINE reine Anzeige-Kosmetik: der Serverriegel in
-- `modul_freischaltung.py` prueft sie, damit die direkte URL nicht daran
-- vorbeifuehrt (ein ausgeblendeter Menuepunkt ist keine Sperre).

alter table public.tenants
  add column if not exists enabled_modules text[] not null default '{}';

comment on column public.tenants.enabled_modules is
  'Freigeschaltete, noch nicht allgemein verfuegbare Module dieses Betriebs '
  '(z. B. ''personal'', ''website_builder''). Leer = nur die allgemein '
  'verfuegbaren Bereiche. Steuert Sichtbarkeit unfertiger Module, ersetzt '
  'weder RLS noch Endpunkt-Autorisierung.';

-- GIN-Index: gefragt wird „enthaelt Modul X", nicht „gleich welcher Liste".
create index if not exists tenants_enabled_modules_idx
  on public.tenants using gin (enabled_modules);

-- AirSmil (a25577cf) bekommt beide Module — der Zustand, der vor dieser
-- Migration fuer ALLE galt, bleibt damit fuer den Beta-Betrieb erhalten.
-- Namentlich statt per Muster: welcher Betrieb ein unfertiges Modul sieht, ist
-- eine Entscheidung, keine Ableitung.
update public.tenants
   set enabled_modules = array['personal', 'website_builder']
 where id = 'a25577cf-c941-45c4-8d23-008887e631aa'::uuid;
