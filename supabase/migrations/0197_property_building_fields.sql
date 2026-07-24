-- 0197 — Airbnb-Zusatzfelder für den Objekttyp-Editor: Etagen im Gebäude, Etage
-- der Einheit, Baujahr, Wohnfläche + Einheit. Echte Spalten (nicht type_attributes),
-- damit später gefiltert/gemeldet werden kann. KEINE neue Typ-Taxonomie — der
-- Objekttyp bleibt property_type (Betriebsart-gefiltert) + booking_property_type,
-- wie im bestehenden /web-Modell (property-meta.ts / booking-property-types.ts).
-- Hinweis: kein eigenes begin/commit — apply-migrations.sh wrappt jede Migration
-- bereits in eine Transaktion.

alter table public.properties
  add column if not exists floors_total smallint,   -- Etagen im Gebäude
  add column if not exists floor_number smallint,   -- Etage, auf der die Einheit liegt
  add column if not exists year_built   smallint,   -- Baujahr
  add column if not exists size_value    numeric,   -- Wohnfläche (Wert)
  add column if not exists size_unit     text;      -- 'sqm' | 'sqft'

-- Keine neuen Grants/RLS nötig: die Spalten erben die bestehende properties-
-- Absicherung (RLS-Policies + Grants aus 0187). Ein anon-Client kann sie also
-- genau so wenig schreiben wie den Rest der Zeile (restriktive Write-Policies).
