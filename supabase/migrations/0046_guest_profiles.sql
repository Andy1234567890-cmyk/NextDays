-- 0046_guest_profiles.sql
-- Enterprise-Gästekarte (Gästeprofil mit allen Stammdaten), angelehnt an
-- OPERA Cloud „Manage Profile" / protel Gästekartei, adaptiert an unser
-- Tenant-/RLS-/Rechtemodell. DSGVO: Ausweisdaten & Consents getrennt, append-only
-- Consent-Historie, Löschung als Anonymisierung (siehe guests-Service).
-- Alle Tabellen tenant-scoped + RLS via public.current_tenant_id() (Muster 0023).

-- ---------------------------------------------------------------------------
-- 1) guests — Stammdaten erweitern (bestehende Tabelle: id/tenant_id/name/
--    email/phone/history/created_at/updated_at). Bestehende Spalten bleiben.
-- ---------------------------------------------------------------------------
alter table public.guests
    add column if not exists salutation        text,       -- Anrede (Herr/Frau/…)
    add column if not exists title             text,       -- Titel (Dr./Prof.)
    add column if not exists first_name        text,
    add column if not exists last_name         text,
    add column if not exists birth_name        text,       -- Geburtsname
    add column if not exists birth_date        date,
    add column if not exists birth_place       text,
    add column if not exists gender            text,       -- nullable (m/f/d/…)
    add column if not exists nationality       text,       -- ISO-Land
    add column if not exists language          text,       -- Korrespondenzsprache (ISO)
    add column if not exists currency          text,
    add column if not exists company           text,
    add column if not exists position          text,       -- Funktion/Position
    add column if not exists vat_id            text,       -- USt-IdNr. (Geschäftsreisende)
    add column if not exists vip_code          text,       -- VIP-Stufe/Code
    add column if not exists segment           text,       -- Marktsegment
    add column if not exists source            text,       -- Quelle/Herkunft
    add column if not exists is_blocked        boolean not null default false,
    add column if not exists block_reason      text,
    -- Loyalty-Aggregate (denormalisiert, vom Service berechnet/aktualisiert):
    add column if not exists stays_count       integer not null default 0,
    add column if not exists last_stay_at      date,
    add column if not exists total_revenue     numeric(12,2) not null default 0,
    -- Audit:
    add column if not exists created_by        uuid references public.users(id) on delete set null,
    add column if not exists updated_by        uuid references public.users(id) on delete set null,
    -- DSGVO: gesetzt bei Anonymisierung (statt Hard-Delete bei Reservierungsbezug):
    add column if not exists anonymized_at     timestamptz;

create index if not exists guests_blocked_idx on public.guests(tenant_id, is_blocked);

-- ---------------------------------------------------------------------------
-- 2) guest_addresses (1:n) — privat/geschäftlich/Rechnung.
-- ---------------------------------------------------------------------------
create table if not exists public.guest_addresses (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    guest_id    uuid not null references public.guests(id) on delete cascade,
    type        text not null default 'private',   -- private|business|billing
    street      text,
    house_no    text,
    postal_code text,
    city        text,
    country     text,                               -- ISO-Land
    is_primary  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists guest_addresses_guest_idx on public.guest_addresses(guest_id);

-- ---------------------------------------------------------------------------
-- 3) guest_contacts (1:n) — mehrere Mails/Telefone.
-- ---------------------------------------------------------------------------
create table if not exists public.guest_contacts (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    guest_id    uuid not null references public.guests(id) on delete cascade,
    type        text not null default 'mobile',     -- mobile|private|business|email
    value       text not null,
    is_primary  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists guest_contacts_guest_idx on public.guest_contacts(guest_id);

-- ---------------------------------------------------------------------------
-- 4) guest_identity_documents (1:n, DSGVO-sensibel) — Zugriff nur mit eigener
--    Berechtigung (VIEW_GUEST_ID_DOCS); Nummern werden vom Service maskiert.
-- ---------------------------------------------------------------------------
create table if not exists public.guest_identity_documents (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    guest_id     uuid not null references public.guests(id) on delete cascade,
    doc_type     text not null,                     -- id_card|passport|driver_license
    number       text not null,                     -- vom Service maskiert ausgegeben
    issuing_country text,                            -- ISO-Land
    valid_until  date,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists guest_id_docs_guest_idx on public.guest_identity_documents(guest_id);

-- ---------------------------------------------------------------------------
-- 5) guest_preferences (1:1) — Objekt-/Zimmerpräferenzen, Diät, Wünsche.
-- ---------------------------------------------------------------------------
create table if not exists public.guest_preferences (
    guest_id        uuid primary key references public.guests(id) on delete cascade,
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    non_smoking     boolean,
    pets            boolean,
    dietary         text,                            -- Diät/Allergien (Freitext)
    preferred_arrival_time text,
    room_preferences text,                           -- bevorzugte Objekt-/Zimmerart
    language        text,
    wishes          text,                            -- Freitext-Wünsche
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6) guest_consents (1:n, append-only) — DSGVO-Einwilligungen (Historie).
--    Kein UPDATE/DELETE in der App: jede Änderung = neue Zeile (granted/revoked).
-- ---------------------------------------------------------------------------
create table if not exists public.guest_consents (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    guest_id     uuid not null references public.guests(id) on delete cascade,
    consent_type text not null,                      -- marketing_email|marketing_sms|data_storage
    status       text not null,                      -- granted|revoked
    source       text,                               -- Herkunft der Einwilligung
    expires_at   timestamptz,                        -- Ablauf/Aufbewahrungsfrist
    created_by   uuid references public.users(id) on delete set null,
    created_at   timestamptz not null default now()
);
create index if not exists guest_consents_guest_idx on public.guest_consents(guest_id, consent_type, created_at);

-- ---------------------------------------------------------------------------
-- 7) guest_notes (1:n, interne Traces — NICHT an den Gast).
-- ---------------------------------------------------------------------------
create table if not exists public.guest_notes (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    guest_id    uuid not null references public.guests(id) on delete cascade,
    author_id   uuid references public.users(id) on delete set null,
    category    text,
    body        text not null,
    created_at  timestamptz not null default now()
);
create index if not exists guest_notes_guest_idx on public.guest_notes(guest_id);

-- ---------------------------------------------------------------------------
-- 8) guest_documents (1:n) — Datei-Referenzen (Supabase Storage).
-- ---------------------------------------------------------------------------
create table if not exists public.guest_documents (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    guest_id     uuid not null references public.guests(id) on delete cascade,
    doc_type     text,
    name         text not null,
    storage_path text not null,                      -- Pfad im Storage-Bucket
    uploaded_by  uuid references public.users(id) on delete set null,
    created_at   timestamptz not null default now()
);
create index if not exists guest_documents_guest_idx on public.guest_documents(guest_id);

-- ---------------------------------------------------------------------------
-- updated_at-Trigger (Tabellen mit updated_at)
-- ---------------------------------------------------------------------------
create trigger trg_guest_addresses_updated before update on public.guest_addresses
    for each row execute function public.set_updated_at();
create trigger trg_guest_contacts_updated before update on public.guest_contacts
    for each row execute function public.set_updated_at();
create trigger trg_guest_id_docs_updated before update on public.guest_identity_documents
    for each row execute function public.set_updated_at();
create trigger trg_guest_preferences_updated before update on public.guest_preferences
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (alle neuen Tabellen, Muster wie 0023/0040)
-- ---------------------------------------------------------------------------
alter table public.guest_addresses          enable row level security;
alter table public.guest_contacts           enable row level security;
alter table public.guest_identity_documents enable row level security;
alter table public.guest_preferences        enable row level security;
alter table public.guest_consents           enable row level security;
alter table public.guest_notes              enable row level security;
alter table public.guest_documents          enable row level security;

create policy guest_addresses_tenant on public.guest_addresses
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy guest_contacts_tenant on public.guest_contacts
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy guest_id_docs_tenant on public.guest_identity_documents
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy guest_preferences_tenant on public.guest_preferences
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
-- Consents: append-only auf App-Ebene (Service schreibt nur INSERT/SELECT);
-- RLS bleibt tenant-scoped für alle Operationen.
create policy guest_consents_tenant on public.guest_consents
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy guest_notes_tenant on public.guest_notes
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy guest_documents_tenant on public.guest_documents
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
