-- 0427_channex_map_sync_enabled_gegenzustand.sql
-- Backstop gegen die Zustandskombination, die es fachlich nicht gibt:
-- eine GESCHLOSSENE Channex-Registrierung, die weiter „sync_enabled" trägt.
--
-- BEFUND (live gemessen 23.08.2026, Beta-Betrieb):
--   FeWo *Stjerneskud* (property 6efd2281-1649-4883-9cf1-4e39f49fec66) hatte
--   drei Zeilen in channex_property_map. Zwei davon waren geschlossen
--   (deleted_at gesetzt), trugen aber weiter sync_enabled = true und
--   last_sync_status = 'ok'. Ihre channex_property_ids (1060923f…, 7f4a5f2f…)
--   zeigen auf Channex-Properties, die es nicht mehr gibt.
--
-- URSACHE: oauth_channels._mapping_schliessen schrieb NUR deleted_at und ließ
--   sync_enabled stehen (behoben im selben Zug). Jeder andere Schließpfad
--   (property_mapping, properties/archiv, content_sync) setzte beides bereits
--   gemeinsam — genau darauf verlässt sich ari_push._is_channex_managed mit
--   seinem Kommentar „sync_enabled wird stets gemeinsam mit deleted_at gesetzt
--   → deleted_at IS NULL genügt". Eine Annahme, die ein einzelner Schreibpfad
--   verletzen konnte, gehört in die DB (Wurzel 2: UNIQUE-/CHECK-Backstop).
--
-- WAS HIER NICHT NÖTIG IST: der partielle UNIQUE-Index gegen mehrere AKTIVE
--   Mappings je Objekt existiert schon seit 0027/0158 als
--   channex_property_map_property_uidx ON (property_id) WHERE deleted_at IS
--   NULL. Er ist live vorhanden und wird von keiner Zeile verletzt (geprüft:
--   0 Gruppen mit count > 1). Die drei Stjerneskud-Zeilen waren deshalb auch
--   kein Index-Verstoß — nur eine davon ist offen. Der Index wird hier lediglich
--   idempotent bestätigt, damit eine frisch aufgesetzte DB ihn sicher hat.

-- 1) Der fehlende Backstop: geschlossen ⇒ nicht mehr eingeschaltet.
--
-- NOT VALID, weil live noch zwei Alt-Zeilen den Zustand tragen. Der Constraint
-- greift damit ab sofort für JEDEN neuen Schreibvorgang (das ist der Zweck:
-- Neuentstehung verhindern), ohne dass diese Migration Kundendaten anfasst.
-- Das Bereinigen der Altlast ist eine bewusste Entscheidung des Betreibers:
--
--   update public.channex_property_map
--      set sync_enabled = false
--    where deleted_at is not null and sync_enabled;
--   alter table public.channex_property_map
--     validate constraint channex_property_map_geschlossen_nicht_aktiv;
--
-- Bewusst NICHT Teil dieser Migration — siehe README/Bericht.
alter table public.channex_property_map
  drop constraint if exists channex_property_map_geschlossen_nicht_aktiv;

alter table public.channex_property_map
  add constraint channex_property_map_geschlossen_nicht_aktiv
  check (deleted_at is null or sync_enabled = false)
  not valid;

comment on constraint channex_property_map_geschlossen_nicht_aktiv
  on public.channex_property_map is
  'Wurzel 1: eine geschlossene Registrierung (deleted_at) ist keine '
  'eingeschaltete (sync_enabled). Verhindert die Kombination, wegen der ein '
  'Objekt live als dreifach verbunden gelesen wurde. NOT VALID: zwei Alt-Zeilen '
  'bestehen noch, deren Bereinigung der Betreiber freigibt.';

-- 2) Bestätigung des bestehenden Ein-aktives-Mapping-Backstops (idempotent).
create unique index if not exists channex_property_map_property_uidx
  on public.channex_property_map (property_id)
  where deleted_at is null;
