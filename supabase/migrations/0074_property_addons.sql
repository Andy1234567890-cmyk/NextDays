-- 0074_property_addons.sql — Zusatzleistungen/Upsells je Objekt (wie Hostaway/Guesty)
--
-- Gäste buchen optionale Extras dazu (Früh-Check-in, Late-Check-out, Reinigung,
-- Transfer, Ausrüstung, Frühstück …) — auf der Buchungsstrecke UND nach der
-- Buchung. Das ist KEINE Custom Fee (pflicht/optional, immer im Preis), sondern
-- ein aktiv dazugebuchtes Upsell mit Medien, Abrechnungsbasis und „wo/wann es
-- erscheint".
--
-- BEWUSST eigene Tabelle statt der vorhandenen, ungenutzten Mechanismen:
--   * property_pricing_config.add_ons (jsonb, 0051) — zu dünn (keine Medien,
--     kein „erscheint in", kein Status); der Resolver liest sie ohnehin nicht.
--   * surcharges-Tabelle (0010) — ungenutzt, kein Upsell-Modell.
-- Beide bleiben für diesen Zweck liegen (kein Doppel-Mechanismus).

create table public.property_addons (
    id            uuid primary key default gen_random_uuid(),
    property_id   uuid not null references public.properties (id) on delete cascade,
    -- Mehrsprachig (Locale → Text), z. B. {"de": "Frühstück", "en": "Breakfast"}.
    name          jsonb not null default '{}'::jsonb,
    description   jsonb not null default '{}'::jsonb,
    -- Medien-URLs (Fotos/Video) im property-images-Bucket, max. 5 (App-seitig geprüft).
    media         jsonb not null default '[]'::jsonb,
    price         numeric(12, 2) not null default 0,
    -- Abrechnungsbasis: pro Aufenthalt / Nacht / Gast / Einheit (Menge).
    basis         text not null default 'per_stay'
                  check (basis in ('per_stay', 'per_night', 'per_guest', 'per_unit')),
    -- Pflicht-Upsell (immer dazu) vs. optional (Gast wählt). Default optional.
    mandatory     boolean not null default false,
    -- Verkaufsflächen: booking_engine / guest_portal / checkin (Teilmenge davon).
    appears_in    text[] not null default array['booking_engine', 'guest_portal']::text[],
    -- „Wann anzeigen": before_checkin (z. B. Früh-Check-in) vs. anytime.
    available_until text not null default 'anytime'
                  check (available_until in ('before_checkin', 'anytime')),
    -- Steuersatz in Prozent (optional; NULL = ohne separate Steuerzeile).
    tax_rate      numeric(5, 2),
    active        boolean not null default true,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index property_addons_property_sort_idx
    on public.property_addons (property_id, sort_order);

create trigger set_updated_at before update on public.property_addons
    for each row execute function public.set_updated_at();

-- RLS: über property -> tenant (Muster wie property_photos, 0061).
alter table public.property_addons enable row level security;
create policy property_addons_via_property on public.property_addons
  for all using (exists (
    select 1 from public.properties p
    where p.id = property_addons.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_addons.property_id
      and p.tenant_id = public.current_tenant_id()));
