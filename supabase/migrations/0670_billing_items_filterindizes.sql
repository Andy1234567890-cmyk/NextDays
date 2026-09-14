-- 0670_billing_items_filterindizes.sql — Indizes für die Filter der Artikelliste
--
-- Die Liste `GET /items` filtert je Tenant nach Kategorie, „nur aktive" und
-- Favoriten; `GET /items/favorites` liest ausschließlich `is_favorite = true`.
-- Beides sind Teilmengen, die bei einem Betrieb mit hunderten Artikeln klein
-- bleiben — deshalb partielle Indizes (nur die true-Zeilen), nicht ein
-- Vollindex über eine boolesche Spalte mit zwei Werten.
--
-- Ein Trigramm-Index für die Freitextsuche (`ilike '%…%'`) ist bewusst NICHT
-- dabei: `pg_trgm` ist im Live-Schema nicht als Abhängigkeit belegt, und die
-- Suche läuft immer hinter `tenant_id = …` — der Tenant-Index aus 0668 grenzt
-- die Zeilen vorher auf den einen Betrieb ein. Sollte ein Betrieb je
-- zehntausende Artikel führen, ist das der Punkt, an dem nachzurüsten wäre.

create index if not exists billing_items_tenant_kategorie_idx
    on public.billing_items (tenant_id, category)
    where category is not null;

create index if not exists billing_items_tenant_favoriten_idx
    on public.billing_items (tenant_id, lower(name))
    where is_favorite = true;

create index if not exists billing_items_tenant_aktiv_idx
    on public.billing_items (tenant_id, lower(name))
    where is_active = true;
