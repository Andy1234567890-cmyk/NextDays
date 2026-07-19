-- 0159_property_marketplace_listing.sql — eigene Marktplatz-Sichtbarkeit
--
-- Der eigene myNextDays-Marktplatz (/plattform) ist ein EIGENER Buchungskanal
-- wie Booking/Airbnb — NICHT „Direkt". Recherche (Channex, SiteMinder, Cloudbeds,
-- Mews, Hostaway, Shopify, Booking.com) einstimmig: Kanal-Sichtbarkeit ist ein
-- pro-Kanal-Zustand, getrennt vom globalen Objekt-Lebenszyklus (properties.status).
-- Bisher trieb allein status='active' BEIDES (OTA-Distribution UND Marktplatz-
-- Listung); das koppelte zwei orthogonale Achsen und verlistete Reverse-Import-
-- Objekte falsch. Diese Spalte führt die Marktplatz-Sichtbarkeit als eigene Achse.
--
-- Modell danach (zwei Achsen):
--   Achse 1 — Objekt-Lebenszyklus: properties.status (draft|active|inactive)
--             = „ist das Objekt überhaupt verkaufbar".
--   Achse 2 — Sichtbarkeit pro Kanal: OTA via channex_property_map.sync_enabled,
--             Marktplatz via properties.listed_on_marketplace (diese Spalte).
--   Regel: auf dem Marktplatz sichtbar = status='active' AND listed_on_marketplace.
--
-- Default true + Bestands-active-Objekte auf true = der aktuelle Ist-Zustand
-- bleibt EXAKT erhalten (heute listet der Marktplatz genau die active-Objekte).
-- Der Publish-Flow setzt das Flag künftig explizit mit; der Channex-Reverse-Import
-- legt Objekte mit listed_on_marketplace=false an (reingespiegelt ≠ auf den
-- eigenen Marktplatz wollen).
--
-- properties hat bereits RLS (0008) + Owner/Staff-Policies (0059/0136). Eine neue
-- Spalte erbt die bestehenden Table-Policies/Grants; kein zusätzliches revoke
-- nötig (die Spalte ist nicht sensibler als title/status, die schon lesbar sind).

alter table public.properties
    add column if not exists listed_on_marketplace boolean not null default true;

comment on column public.properties.listed_on_marketplace is
    'Sichtbarkeit auf dem eigenen myNextDays-Marktplatz (/plattform) als eigener '
    'Buchungskanal. Getrennt von status (Lebenszyklus) und von der OTA-'
    'Distribution (channex_property_map.sync_enabled). Marktplatz-Listung = '
    'status=active AND listed_on_marketplace.';

-- Bestands-Ist-Zustand festschreiben: heute sichtbar = status='active'. Nicht-
-- aktive Objekte bleiben zwar auf default true, sind aber durch status ohnehin
-- unsichtbar — beim späteren Publish greift der explizite Flag-Set des Flows.
-- (Idempotent; default true deckt neue Zeilen ab.)
update public.properties
   set listed_on_marketplace = true
 where status = 'active'
   and listed_on_marketplace is distinct from true;
