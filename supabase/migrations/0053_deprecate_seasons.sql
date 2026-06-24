-- 0053_deprecate_seasons.sql — Saison-Parallelmodell als deprecated markieren
--
-- Eine Preis-Wahrheit: Saisonpreise laufen über price_overrides (tagesgenau,
-- vom Kalender gelesen + in Realtime). Das zweite, NIE genutzte Saison-Modell
-- aus 0011 (season_templates/seasons/season_periods/season_assignments) ist ein
-- toter Parallelweg und wird NICHT mehr referenziert.
--
-- Wir LÖSCHEN nichts (keine Datenmigration nötig, kein Code liest diese Tabellen),
-- sondern markieren sie nur per COMMENT als deprecated, damit der tote Pfad in
-- der DB-Inspektion sichtbar deprecatet ist. events/event_periods bleiben unberührt
-- (separate Funktion, nicht Teil des Saisonpreis-Pfades).

comment on table public.season_templates is
  'DEPRECATED (0053): ungenutztes Saison-Parallelmodell. Saisonpreise laufen über '
  'price_overrides. Nicht referenzieren.';
comment on table public.seasons is
  'DEPRECATED (0053): siehe season_templates. Saisonpreise über price_overrides.';
comment on table public.season_periods is
  'DEPRECATED (0053): siehe season_templates. Saisonpreise über price_overrides.';
comment on table public.season_assignments is
  'DEPRECATED (0053): siehe season_templates. Saisonpreise über price_overrides.';
