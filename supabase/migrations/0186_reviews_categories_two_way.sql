-- 0186_reviews_categories_two_way.sql
-- Gästebewertungen Booking+Airbnb-Modell. Erweitert das bestehende reviews (0006/0181)
-- um Kategorie-Sub-Scores + legt die Zwei-Wege-Bewertung (Host bewertet Gast) an.
--
-- SICHERHEIT (Wurzel 6): reviews ist öffentlich lesbar (Produktdaten), Schreiben
-- NUR über service_role (Server verifiziert Gast + abgeschlossene Reservierung) —
-- war in 0181 bereits gesetzt (revoke insert/update/delete; grant select).
-- guest_reviews_by_host ist personenbezogen + NICHT öffentlich → voll gesperrt
-- (kein grant select an anon/authenticated), nur service_role.

-- =========================================================================
-- 1. reviews: 6 Kategorie-Sub-Scores (Booking.com-Modell, je 1..5) + Sichtbarkeit
-- =========================================================================
-- Nullable, weil Alt-Reviews (nur Gesamt-rating) bestehen bleiben; neue Abgaben
-- setzen sie server-seitig. CHECK 1..5 je Spalte (DB-Backstop zur Pydantic-
-- Validierung; fail-closed auch bei Direkt-service_role-Insert, Wurzel 5).
alter table public.reviews
    add column if not exists score_cleanliness   smallint check (score_cleanliness   between 1 and 5),
    add column if not exists score_communication smallint check (score_communication between 1 and 5),
    add column if not exists score_location      smallint check (score_location      between 1 and 5),
    add column if not exists score_value         smallint check (score_value         between 1 and 5),
    add column if not exists score_accuracy      smallint check (score_accuracy      between 1 and 5),
    add column if not exists score_checkin       smallint check (score_checkin       between 1 and 5),
    -- Airbnb double-blind: Review sichtbar, wenn beide Seiten abgegeben haben ODER
    -- 14-Tage-Frist abgelaufen. NULL = verdeckt. Öffentlicher Lesepfad filtert
    -- published_at is not null.
    add column if not exists published_at        timestamptz;

comment on column public.reviews.score_cleanliness is
  'Booking-Kategorie 1..5 (Sauberkeit). NULL bei Alt-Reviews ohne Sub-Scores.';
comment on column public.reviews.published_at is
  'Sichtbar ab: gesetzt bei beidseitiger Abgabe ODER nach 14-Tage-Frist. '
  'NULL = verdeckt (Airbnb double-blind). Öffentlicher Lesepfad filtert not null.';

-- Teilindex für den öffentlichen Aggregat-/Listenpfad: nur veröffentlichte Reviews.
create index if not exists reviews_property_published_idx
    on public.reviews (property_id, published_at)
    where published_at is not null;

-- =========================================================================
-- 2. guest_reviews_by_host: Host bewertet Gast (Zwei-Wege) — NICHT öffentlich
-- =========================================================================
create table if not exists public.guest_reviews_by_host (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    reservation_id  uuid not null references public.reservations (id) on delete cascade,
    property_id     uuid not null references public.properties (id) on delete cascade,
    -- Der bewertete Gast: E-Mail als Anker (Gast hat evtl. kein Portal-Konto),
    -- portal_guest_id nur wenn vorhanden.
    guest_email     text not null,
    portal_guest_id uuid references public.portal_guests (id) on delete set null,
    rating          smallint not null check (rating between 1 and 5),
    -- Airbnb-Gast-Kategorien: Sauberkeit, Kommunikation, Hausregeln.
    score_cleanliness   smallint check (score_cleanliness   between 1 and 5),
    score_communication smallint check (score_communication between 1 and 5),
    score_house_rules   smallint check (score_house_rules   between 1 and 5),
    text            text,
    published_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    -- Idempotenz-Backstop (Wurzel 2): ein Host bewertet eine Reservierung genau
    -- einmal. Doppelklick/Retry → 23505 → 409 im Service.
    unique (reservation_id)
);

create index if not exists guest_reviews_by_host_tenant_idx
    on public.guest_reviews_by_host (tenant_id);
create index if not exists guest_reviews_by_host_email_idx
    on public.guest_reviews_by_host (lower(guest_email));

create trigger set_updated_at before update on public.guest_reviews_by_host
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 3. RLS + harter GRANT-Entzug (Wurzel 6)
-- =========================================================================
alter table public.guest_reviews_by_host enable row level security;

-- Restriktive Tenant-Policy für ALLE Operationen (nicht nur select) als Backstop.
create policy guest_reviews_by_host_tenant_isolation on public.guest_reviews_by_host
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Harter Entzug: weder lesen noch schreiben für anon/authenticated. Host-Bewertung
-- des Gasts ist personenbezogen + intern → verlässt die DB nur über den Server.
-- (Kein grant select — anders als reviews, das öffentliche Produktdaten sind.)
revoke select, insert, update, delete on public.guest_reviews_by_host from anon;
revoke select, insert, update, delete on public.guest_reviews_by_host from authenticated;

-- Realtime — speist die Host-Bewertungs-Ansicht im Dashboard.
alter table public.guest_reviews_by_host replica identity full;
alter publication supabase_realtime add table public.guest_reviews_by_host;

comment on table public.guest_reviews_by_host is
  'Host bewertet Gast (Zwei-Wege, Airbnb-Modell). Nicht öffentlich: nur '
  'service_role liest/schreibt (Wurzel 6). Ein Datensatz je Reservierung (UNIQUE).';

-- Hinweis: reviews-GRANTs bleiben wie in 0181 (öffentliches SELECT, insert/update/
-- delete für anon/authenticated entzogen). Keine erneute reviews-GRANT-Änderung nötig.
