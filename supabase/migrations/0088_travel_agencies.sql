-- 0088_travel_agencies.sql — Reisebüro-/Reiseveranstalter-Kartei (B2B-Partner)
--
-- Modell nach Oracle OPERA Cloud „Sales Account / Travel Agent Profile"
-- (Profile + Negotiated Rates + Corporate Agreements + Attachments),
-- adaptiert auf myNextDays-Größe (keine Kommissions-Zahlläufe, keine Blocks):
--   travel_agencies          — Partnerprofil (Stammdaten, Kommission, Settlement)
--   travel_agency_contacts   — Kontaktpersonen (Unterliste, kein eigenes Modul)
--   travel_agency_contracts  — Verträge (Gültigkeit von–bis → nach Jahren
--                              gruppierbar; Vertragsart aus der Touristik:
--                              Allotment/Garantie/Free-Sale; Datei im Storage)
--   travel_agency_rates      — Saison-Preiszeilen am Vertrag (Zeitraum × Objekt
--                              × Preis, Netto/Brutto, Min-Stay) — das Rate-Sheet
--
-- Verknüpfung zum Verkaufsstopp: stop_sell.agency_id (nullable) dokumentiert,
-- an welchen Partner sich ein manueller Stopp richtet (Touristik-Praxis:
-- Stop-Sale-Meldung an den Veranstalter). NULL = gilt allen Kanälen.
--
-- Storage: privater Bucket `agency-contracts` (B2B-Preise/Verträge sind
-- vertraulich — anders als die public Buckets für Objektfotos). Zugriff NUR
-- über das Backend (Service-Role: Upload + signierte Download-URLs), daher
-- keine storage.objects-Policy nötig; der Bucket bleibt für anon/auth dicht.

-- ---------------------------------------------------------------------------
-- Partnerprofil
-- ---------------------------------------------------------------------------
create table if not exists public.travel_agencies (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    -- OPERA-Profiltypen (Sales Accounts): Reisebüro, Veranstalter, Firma, Source.
    kind        text not null default 'travel_agent'
                check (kind in ('travel_agent', 'tour_operator', 'company', 'source')),
    name        text not null,
    iata_number text,          -- IATA-/Corp-Nummer (OPERA „Corp ID / IATA No.")
    vat_id      text,          -- USt-IdNr
    address     text,
    city        text,
    postal_code text,
    country     text,          -- ISO-2
    email       text,
    phone       text,
    website     text,
    language    text,          -- Korrespondenzsprache (ISO-639-1)
    currency    text,          -- Referenzwährung (ISO-4217); Verträge tragen ihre eigene
    -- Standard-Kommission des Partners (Verträge können sie überschreiben).
    commission_pct numeric(5, 2) check (commission_pct >= 0 and commission_pct <= 100),
    -- Abrechnung (Mews-Settlement, vereinfacht): Gast zahlt uns (hotel_collect)
    -- oder Partner kassiert und führt ab (agency_collect).
    settlement  text check (settlement in ('hotel_collect', 'agency_collect')),
    payment_term_days integer check (payment_term_days >= 0),
    is_active   boolean not null default true,
    notes       text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists travel_agencies_tenant_idx on public.travel_agencies(tenant_id);

-- ---------------------------------------------------------------------------
-- Kontaktpersonen
-- ---------------------------------------------------------------------------
create table if not exists public.travel_agency_contacts (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants(id) on delete cascade,
    agency_id  uuid not null references public.travel_agencies(id) on delete cascade,
    name       text not null,
    role       text,
    email      text,
    phone      text,
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists travel_agency_contacts_agency_idx
    on public.travel_agency_contacts(agency_id);

-- ---------------------------------------------------------------------------
-- Verträge (nach Jahren sortiert über valid_from; Status berechnet das Frontend
-- aus valid_from/valid_to — kein manuell gepflegtes Status-Feld)
-- ---------------------------------------------------------------------------
create table if not exists public.travel_agency_contracts (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants(id) on delete cascade,
    agency_id  uuid not null references public.travel_agencies(id) on delete cascade,
    title      text not null,
    -- Vertragsart (Touristik): Allotment/Kontingent, Garantie, Free Sale.
    kind       text not null default 'other'
               check (kind in ('allotment', 'guarantee', 'free_sale', 'other')),
    valid_from date not null,
    valid_to   date not null,
    check (valid_to >= valid_from),
    currency   text not null,  -- Währung des Rate-Sheets (ISO-4217, aus den Daten)
    -- Kommission dieses Vertrags (überschreibt den Partner-Standard).
    commission_pct numeric(5, 2) check (commission_pct >= 0 and commission_pct <= 100),
    release_days integer check (release_days >= 0),  -- Release-Frist (Allotment)
    storage_path text,         -- Vertragsdokument im Bucket agency-contracts
    file_name    text,         -- Original-Dateiname fürs UI
    notes      text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists travel_agency_contracts_agency_idx
    on public.travel_agency_contracts(agency_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- Saison-Preiszeilen am Vertrag (Rate-Sheet: Zeitraum × Objekt → Preis/Nacht)
-- ---------------------------------------------------------------------------
create table if not exists public.travel_agency_rates (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    agency_id   uuid not null references public.travel_agencies(id) on delete cascade,
    contract_id uuid not null references public.travel_agency_contracts(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    season_start date not null,
    season_end   date not null,
    check (season_end >= season_start),
    price       numeric(12, 2) not null check (price >= 0),  -- pro Nacht
    -- Netto (Partner kalkuliert Marge selbst) oder Brutto (Kommission wird abgezogen).
    basis       text not null check (basis in ('net', 'gross')),
    min_stay    integer check (min_stay >= 1),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists travel_agency_rates_contract_idx
    on public.travel_agency_rates(contract_id, season_start);
create index if not exists travel_agency_rates_property_idx
    on public.travel_agency_rates(property_id);

-- ---------------------------------------------------------------------------
-- Verkaufsstopp ↔ Partner (dokumentiert den Adressaten der Stop-Sale-Meldung)
-- ---------------------------------------------------------------------------
alter table public.stop_sell
    add column if not exists agency_id uuid references public.travel_agencies(id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at-Trigger
-- ---------------------------------------------------------------------------
create trigger trg_travel_agencies_updated before update on public.travel_agencies
    for each row execute function public.set_updated_at();
create trigger trg_travel_agency_contacts_updated before update on public.travel_agency_contacts
    for each row execute function public.set_updated_at();
create trigger trg_travel_agency_contracts_updated before update on public.travel_agency_contracts
    for each row execute function public.set_updated_at();
create trigger trg_travel_agency_rates_updated before update on public.travel_agency_rates
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (default-deny Tenant-Policy, Muster 0046/0084)
-- ---------------------------------------------------------------------------
alter table public.travel_agencies         enable row level security;
alter table public.travel_agency_contacts  enable row level security;
alter table public.travel_agency_contracts enable row level security;
alter table public.travel_agency_rates     enable row level security;

create policy travel_agencies_tenant on public.travel_agencies
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy travel_agency_contacts_tenant on public.travel_agency_contacts
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy travel_agency_contracts_tenant on public.travel_agency_contracts
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy travel_agency_rates_tenant on public.travel_agency_rates
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Realtime (Listen/Detail-UIs sind WebSocket-Pflicht)
-- ---------------------------------------------------------------------------
alter table public.travel_agencies         replica identity full;
alter table public.travel_agency_contacts  replica identity full;
alter table public.travel_agency_contracts replica identity full;
alter table public.travel_agency_rates     replica identity full;

do $$
declare
  t text;
  tables text[] := array[
    'travel_agencies', 'travel_agency_contacts',
    'travel_agency_contracts', 'travel_agency_rates'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage-Bucket für Vertragsdokumente (PRIVAT — Zugriff nur übers Backend)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'agency-contracts',
    'agency-contracts',
    false,
    26214400,  -- 25 MB (deckt core/uploads.MAX_UPLOAD_BYTES ab)
    array['application/pdf', 'image/jpeg', 'image/png',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
