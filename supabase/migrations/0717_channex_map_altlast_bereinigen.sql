-- 0717_channex_map_altlast_bereinigen.sql
-- Die Altlast aus 0427 raeumen und den Backstop scharf schalten.
--
-- 0427 legte den Constraint `channex_property_map_geschlossen_nicht_aktiv`
-- bewusst als NOT VALID an und liess die Bereinigung der bestehenden Zeilen
-- ausdruecklich dem Betreiber. Diese Entscheidung ist am 17.09.2026 gefallen;
-- die beiden Zeilen stehen seit dem 07.08.2026 unveraendert.
--
-- WAS SIE ANGERICHTET HABEN (live gemessen 17.09.2026, Betrieb AirSmil,
-- FeWo *Stjerneskud*, property 6efd2281-1649-4883-9cf1-4e39f49fec66):
-- `content_sync._mark_property_sync` stempelte bis zum Fix ohne
-- `deleted_at`-Filter und traf die beiden Zeilen mit. Weil der Constraint bei
-- JEDEM Update einer verletzenden Zeile greift, kippte das Statement mit 23514
-- — samt der gesunden Zeile. Ergebnis: 44 tote `sync_property_content`-Jobs,
-- 453 Versuche seit dem 24.08.2026, jeder mit vollem Content-Push gegen das
-- Channex-Budget, und der Content-Fluss (Fotos, Ausstattung, Steuern,
-- Hotel-Policy) stand 24 Tage still. Der Preis-Fluss war nie betroffen: er
-- laeuft ueber `recompute_property`/`ari_push` und filtert selbst auf
-- `deleted_at is null`.
--
-- WARUM ES TROTZ DES FIXES NOETIG IST: der Schreibpfad-Fix macht die Zeilen
-- nur harmlos. Solange sie den Zustand tragen, bleibt der Constraint NOT VALID
-- und schuetzt kuenftige Schreibpfade nicht rueckwirkend — und jede andere
-- Stelle, die diese Zeilen jemals anfasst, laeuft erneut in den 23514.

-- 1) Der Gegenzustand, den 0427 offen liess: geschlossen ⇒ nicht eingeschaltet.
--    Trifft ausschliesslich Zeilen, die bereits geschlossen sind — eine offene
--    Zuordnung wird hier unter keinen Umstaenden abgeschaltet.
update public.channex_property_map
   set sync_enabled = false
 where deleted_at is not null
   and sync_enabled;

-- 2) Jetzt traegt keine Zeile mehr den verbotenen Zustand → der Constraint
--    laesst sich validieren. Ab hier ist er ein echter Backstop und nicht mehr
--    nur eine Regel fuer Neuschreibungen (Wurzel 2: UNIQUE-/CHECK-Backstop in
--    der DB, nicht bloss Disziplin im Service).
--    VALIDATE nimmt nur SHARE UPDATE EXCLUSIVE — kein Schreib-Lock auf die
--    Tabelle, laufende Buchungen und Syncs sind davon nicht betroffen.
alter table public.channex_property_map
  validate constraint channex_property_map_geschlossen_nicht_aktiv;

comment on constraint channex_property_map_geschlossen_nicht_aktiv
  on public.channex_property_map is
  'Wurzel 1: eine geschlossene Registrierung (deleted_at) ist keine '
  'eingeschaltete (sync_enabled). Seit 0717 VALIDATED — die zwei Alt-Zeilen '
  'von AirSmil sind bereinigt, der Backstop gilt fuer den gesamten Bestand.';
