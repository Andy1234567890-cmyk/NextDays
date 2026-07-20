-- 0162_property_listed_on_website.sql — eigene Website-Kanal-Sichtbarkeit
--
-- myNextDays vertreibt jedes Objekt über DREI gleichrangige Kanäle, deren
-- Sichtbarkeit PRO KANAL schaltbar ist (Industrie-Standard, belegt: Guesty,
-- Cloudbeds, SiteMinder, Hostaway — kein globales „publiziert"-Flag):
--   1. Website  — die eigene Kunden-Website (Page-Builder / white-label Site)
--   2. Plattform — der eigene myNextDays-Marktplatz (properties.listed_on_marketplace, 0159)
--   3. Portale   — Channex → OTAs (channex_property_map.sync_enabled + Verbindung)
--
-- Für die Website fehlte bisher eine eigene Sichtbarkeits-Achse. Diese Spalte
-- führt sie ein — exakt analog zu listed_on_marketplace (0159): eine eigene,
-- pro-Kanal schaltbare Achse, GETRENNT vom Objekt-Lebenszyklus (properties.status).
--
-- Modell danach (zwei Ebenen):
--   Ebene A — Lebenszyklus: properties.status (draft|active|inactive)
--             = „ist das Objekt überhaupt verkaufbar".
--   Ebene B — Sichtbarkeit pro Kanal:
--             Website   via properties.listed_on_website (diese Spalte)
--             Plattform via properties.listed_on_marketplace (0159)
--             Portale   via channex_property_map.sync_enabled + Verbindung
--   Regel je Kanal: sichtbar = status='active' AND Kanal-Flag AND Verfügbarkeit.
--
-- Default true + Bestands-active-Objekte auf true = der aktuelle Ist-Zustand
-- bleibt erhalten (bisher trieb allein status='active' auch die Website-Sicht).
-- Der Publish-Flow setzt das Flag künftig explizit mit (1 Klick = alle Kanäle),
-- jeder Kanal bleibt danach einzeln schaltbar.
--
-- properties hat bereits RLS (0008) + Owner/Staff-Policies (0059/0136). Eine neue
-- Spalte erbt die bestehenden Table-Policies/Grants; sie ist nicht sensibler als
-- status/listed_on_marketplace (schon lesbar) → kein zusätzliches revoke nötig.

alter table public.properties
    add column if not exists listed_on_website boolean not null default true;

comment on column public.properties.listed_on_website is
    'Sichtbarkeit auf der eigenen Kunden-Website (Page-Builder) als eigener '
    'Vertriebskanal. Getrennt von status (Lebenszyklus), listed_on_marketplace '
    '(eigener Marktplatz) und der OTA-Distribution (channex_property_map). '
    'Website-Sichtbarkeit = status=active AND listed_on_website.';

-- Bestands-Ist-Zustand festschreiben (idempotent; default true deckt neue Zeilen).
update public.properties
   set listed_on_website = true
 where status = 'active'
   and listed_on_website is distinct from true;
