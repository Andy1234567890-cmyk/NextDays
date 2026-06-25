-- 0075_reservation_addons.sql — gekaufte Zusatzleistungen je Reservierung
--
-- Eine Zeile je dazugebuchtem Upsell (auf der Buchungsstrecke ODER nach der
-- Buchung übers Gäste-Portal). Snapshot von Name/Preis/Basis/Steuer zum
-- Kaufzeitpunkt, damit spätere Katalog-Änderungen die Reservierung nicht
-- rückwirkend verändern (gleiches Prinzip wie reservations.quote_items).
--
-- Zahlstatus ist Payment-gegatet: pending -> paid (sofortige separate
-- Kartenbelastung, sobald der Payment-Provider live ist — primär Revolut, Stripe
-- sekundär, ADR-0003) bzw. ohne Provider „zahlbar bei Anreise" (manuell als paid
-- markierbar). Anzeige/Buchung sind NICHT an Payment blockiert — nur der Status
-- wird geführt.

create table public.reservation_addons (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    reservation_id uuid not null references public.reservations (id) on delete cascade,
    -- Katalog-Add-on; bleibt referenziert, Snapshot-Felder sind aber autark.
    addon_id       uuid references public.property_addons (id) on delete set null,
    -- Snapshot zum Kaufzeitpunkt (Locale → Text wie im Katalog).
    name           jsonb not null default '{}'::jsonb,
    price          numeric(12, 2) not null default 0,
    basis          text not null default 'per_stay'
                   check (basis in ('per_stay', 'per_night', 'per_guest', 'per_unit')),
    tax_rate       numeric(5, 2),
    qty            integer not null default 1 check (qty >= 1),
    -- Gesamt inkl. Basis-Hochrechnung + Steuer (vom Service berechnet, nicht Client).
    total          numeric(12, 2) not null default 0,
    status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'cancelled')),
    charged_at     timestamptz,
    created_at     timestamptz not null default now()
);

create index reservation_addons_reservation_idx
    on public.reservation_addons (reservation_id);
create index reservation_addons_tenant_idx
    on public.reservation_addons (tenant_id);

-- RLS: tenant-direkt (Muster wie owners, 0063) — tenant_id ist denormalisiert
-- vorhanden, das deckt Dashboard (Agentur) und Owner-Statement-Joins ab.
alter table public.reservation_addons enable row level security;
create policy reservation_addons_tenant on public.reservation_addons
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Realtime: Käufe/Statuswechsel pushen (Projekt-Grundsatz WebSocket, kein Polling).
alter publication supabase_realtime add table public.reservation_addons;
