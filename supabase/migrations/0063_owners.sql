-- 0063_owners.sql — Eigentümer-Stammdaten + Objekt-Zuordnung + Payout-Feld
--
-- Agenturen verwalten Objekte für FREMDE Eigentümer. Bisher gab es nur:
--   * co_owners (0014): reine Kontaktliste je Objekt, KEIN Login, keine
--     Auszahlungs-/Provisions-Konfiguration.
--   * owner_property_assignments (0058): verknüpft einen Eigentümer-LOGIN-User
--     mit Objekten (Portal-Scoping). Keine Stammdaten.
--
-- Diese Migration führt die verwaltete Eigentümer-PARTEI als eigene Entität ein
-- (getrennt vom Login-User): Stammdaten, Bankverbindung, Default-Provision,
-- Statement-Frequenz. Plus den Link owner↔property mit Anteil + Provisions-
-- Override. Backfill aus co_owners. co_owners bleibt als Kontaktliste bestehen,
-- wird aber als deprecated markiert (Kommentar) — die Wahrheit ist ab jetzt owners.
--
-- Zusätzlich: reservations.channel_fee — die Kanalgebühr je Reservierung, damit
-- der Owner-Statement-„Total Payout" = total_amount − channel_fee EXPLIZIT (nicht
-- geraten) gerechnet wird. Default 0 (noch kein Importer befüllt es; Payout = Price,
-- bis Kanalgebühren erfasst werden — kein erfundener Abzug).

-- == Payout-Feld auf reservations ===========================================
alter table public.reservations
    add column if not exists channel_fee numeric(12, 2) not null default 0
        check (channel_fee >= 0);

comment on column public.reservations.channel_fee is
    'Kanal-/OTA-Gebühr je Reservierung. Total Payout = total_amount − channel_fee.';

-- == Eigentümer-Partei (verwaltet, getrennt vom Login-User) ==================
create table public.owners (
    id                    uuid primary key default gen_random_uuid(),
    tenant_id             uuid not null references public.tenants (id) on delete cascade,
    name                  text not null,
    company               text,
    email                 text,
    phone                 text,
    -- Strukturierte Adresse (wie properties).
    street                text,
    house_number          text,
    postal_code           text,
    city                  text,
    country               text,
    tax_id                text,
    vat_id                text,
    -- Auszahlungs-Bankdaten.
    iban                  text,
    bic                   text,
    bank_name             text,
    account_holder        text,
    -- Default-Management-Provision (%) und Auszahlungs-/Statement-Konfig.
    default_commission_pct numeric(5, 2) not null default 0
        check (default_commission_pct >= 0 and default_commission_pct <= 100),
    default_payout_method  text,
    statement_frequency    text not null default 'none'
        check (statement_frequency in ('none', 'monthly')),
    notes                 text,
    -- Optionale Verknüpfung zum Owner-Login-User (für das Self-Service-Portal).
    user_id               uuid references public.users (id) on delete set null,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index owners_tenant_id_idx on public.owners (tenant_id);
create index owners_user_id_idx on public.owners (user_id);

create trigger set_updated_at before update on public.owners
    for each row execute function public.set_updated_at();

-- == Link Eigentümer ↔ Objekt (Anteil + Provisions-Override) ================
create table public.owner_properties (
    id                   uuid primary key default gen_random_uuid(),
    owner_id             uuid not null references public.owners (id) on delete cascade,
    property_id          uuid not null references public.properties (id) on delete cascade,
    ownership_share      numeric(5, 2) not null default 100
        check (ownership_share >= 0 and ownership_share <= 100),
    commission_override_pct numeric(5, 2)
        check (commission_override_pct is null
               or (commission_override_pct >= 0 and commission_override_pct <= 100)),
    created_at           timestamptz not null default now(),
    unique (owner_id, property_id)
);

create index owner_properties_owner_id_idx on public.owner_properties (owner_id);
create index owner_properties_property_id_idx on public.owner_properties (property_id);

-- == RLS ====================================================================
-- owners: tenant-direkt (Muster wie properties, 0008).
alter table public.owners enable row level security;
create policy owners_tenant on public.owners
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- owner_properties: über owner → tenant (Muster wie price_overrides via property).
alter table public.owner_properties enable row level security;
create policy owner_properties_via_owner on public.owner_properties
  for all using (exists (
    select 1 from public.owners o
    where o.id = owner_properties.owner_id
      and o.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.owners o
    where o.id = owner_properties.owner_id
      and o.tenant_id = public.current_tenant_id()));

-- == Backfill aus co_owners =================================================
-- Jede co_owners-Zeile (Kontakt je Objekt) wird zu genau einem owner + einem
-- owner_properties-Link. tenant_id stammt aus der Eltern-property. share_percent →
-- ownership_share (Default 100, wenn leer). co_owners ohne Name werden übersprungen
-- (name ist not null). Zeilenweise (DO-Block), damit jede Quelle exakt einen owner
-- erzeugt — kein fragiler Name/E-Mail-Join, der bei Namensgleichheit dupliziert.
do $$
declare
    c        record;
    v_owner  uuid;
begin
    for c in
        select co.id, co.name, co.email, co.phone, co.share_percent,
               co.property_id, p.tenant_id
        from public.co_owners co
        join public.properties p on p.id = co.property_id
        where coalesce(trim(co.name), '') <> ''
    loop
        insert into public.owners (tenant_id, name, email, phone)
        values (c.tenant_id, c.name, c.email, c.phone)
        returning id into v_owner;

        insert into public.owner_properties (owner_id, property_id, ownership_share)
        values (v_owner, c.property_id, coalesce(c.share_percent, 100))
        on conflict (owner_id, property_id) do nothing;
    end loop;
end
$$;

comment on table public.co_owners is
    'DEPRECATED (0063): reine Kontaktliste. Verwaltete Eigentümer liegen in owners + owner_properties.';
