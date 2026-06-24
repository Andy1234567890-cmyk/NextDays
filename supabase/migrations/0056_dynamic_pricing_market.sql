-- 0056_dynamic_pricing_market.sql — Dynamic Pricing Phase 2 (Markt-Signal + Preis-Erklärung)
--
-- Additiv auf 0055. Erweitert dp_settings um die Markt-/Wettbewerbs-Schalter und
-- dynamic_prices um die persistierte Faktor-Aufschlüsselung (factors), damit der
-- Kalender „Warum dieser Preis?" erklären kann.
--
-- Markt ist OPT-IN zusätzlich zu enabled (market_enabled default false). Ohne
-- Markt-Signal (NullProvider / kein Wert) bleibt der Markt-Faktor neutral (1.0)
-- → die Engine verhält sich exakt wie Phase 1. Kein Datenverlust, ändert nichts
-- am Pricing, bis ein Vermieter Markt-Daten aktiviert.

-- == dp_settings: Markt-/Wettbewerbs-Konfiguration ==========================
alter table public.dp_settings
    add column if not exists market_enabled       boolean not null default false,
    -- Gewicht, mit dem der eigene Preis Richtung Markt-Median korrigiert wird (%).
    add column if not exists market_sensitivity   numeric(6, 2) not null default 20,
    -- Deckel: maximale Markt-Korrektur in beide Richtungen (%).
    add column if not exists market_max_adjust_pct numeric(6, 2) not null default 25,
    -- Markt-Schlüssel (z. B. AirDNA-Market/Region) + Comp-Set (vergleichbare Listings).
    add column if not exists market_key           text,
    add column if not exists comp_refs            jsonb not null default '[]'::jsonb;

-- == dynamic_prices: Faktor-Aufschlüsselung persistieren ====================
-- Die Engine liefert factors bereits (season/event/weekend/occupancy/last_minute/
-- orphan/market); recompute schreibt sie hier mit. UI zeigt sie als Erklärung.
alter table public.dynamic_prices
    add column if not exists factors jsonb not null default '{}'::jsonb;
