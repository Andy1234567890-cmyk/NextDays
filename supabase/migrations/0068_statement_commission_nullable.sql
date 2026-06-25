-- 0068_statement_commission_nullable.sql — Provision je Objekt vs. globaler Override
--
-- Bisher war owner_statements.commission_pct NOT NULL DEFAULT 0 → eine
-- Abrechnung kannte nur EINEN pauschalen Provisionssatz und ignorierte die in
-- den Stammdaten je Objekt konfigurierte Provision
-- (owner_properties.commission_override_pct, sonst owners.default_commission_pct).
--
-- Neue Semantik:
--   commission_pct IS NULL  → Provision je Objekt aus den Stammdaten anwenden
--                             (korrekt auch bei unterschiedlichen Sätzen je Objekt)
--   commission_pct = <Zahl> → manueller, abrechnungsweiter Override (Editor)
--
-- Damit lassen sich Owner-Default UND Objekt-Override sauber abbilden, ohne dass
-- der gespeicherte Satz die Per-Objekt-Rechnung verfälscht.

alter table public.owner_statements
    alter column commission_pct drop not null,
    alter column commission_pct drop default;
