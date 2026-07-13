-- 0127_property_dossier.sql — 8-stufige Objektkartei (Datenblätter/Onboarding,
-- Lastenheft §6). Objekt-gebundene Prozess-/Zugangs-/Service-/Marketing-/Status-
-- daten. KEINE OTA-/Channex-Relevanz — bewusst getrennt vom properties-Update-Pfad
-- (eigener Slice property_dossier), damit Kartei-Felder keinen Content-Sync auslösen.
--
-- WICHTIG (i18n, 24 Sprachen): ALLE Enum-artigen Spalten speichern
-- SPRACHNEUTRALE englische Keys (z. B. boligtype 'flex'/'year_round'/'holiday',
-- NICHT 'flexbolig'/'fritidshus'). Die menschenlesbaren Labels leben im Frontend
-- im next-intl-Namespace 'dossier', nie in der DB.
--
-- Was NICHT hier entsteht (nutzt Bestehendes):
--   Eigentümer-Stammdaten/Bank → owners + owner_properties (Kartei zeigt read-only).
--   Zugangscodes/WLAN → property_guest_portal + type_attributes.messaging.
--   Begrüßungstext/Geheimtipps → type_attributes.messaging (LocalizedText).
--   Grundpreis/Sperrungen → property_pricing_config/availability/stop_sell/channex.
--
-- RLS + owner-scope + Realtime in 0128.

-- === owners: dänische Personennummer (CPR) ergänzen ===
-- Fehlt in owners (IBAN/BIC/bank_name/account_holder/tax_id/vat_id existieren schon).
-- nullable, global einsetzbar (nur DK-Ferienhäuser befüllen es).
alter table public.owners
  add column if not exists cpr_number text;

-- === properties: Objektinformations-Basisfelder (Stufe 1) ===
-- bfe_number/boligtype existieren bereits (0009). Diese Felder gehen NICHT an OTAs
-- (nicht in _CONTENT_FIELDS aufnehmen).
alter table public.properties
  add column if not exists internal_house_no text,
  add column if not exists house_name text,
  add column if not exists capacity_persons integer,
  add column if not exists capacity_sqm numeric(10, 2);

-- === Stufe 2: Proces & Kontrakt (1:1, reine Prozessdaten) ===
create table if not exists public.property_process (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  first_meeting_at date,
  contract_sent_at date,
  contract_signed_at date,
  onboarding_invoice_sent_at date,
  onboarding_invoice_paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Stufe 3: Adgang & Teknik (1:1) — nur was NICHT im Gastmodul liegt ===
-- door_code/self_checkin → property_guest_portal; WLAN/Türtext → messaging.
-- key_status: neutrale Keys 'agency_extra' | 'owner_only'.
create table if not exists public.property_access (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  key_status text,          -- Key: agency_extra | owner_only
  key_placement text,       -- interne Notiz (physische Platzierung)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Stufe 4: Serviceaftaler (1:n) ===
-- service_type: neutrale Keys 'caretaker' | 'window_cleaning' | 'lawn_mowing' | ...
create table if not exists public.property_service_agreements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  service_type text not null,   -- Key
  frequency text,
  price numeric(12, 2),
  currency text,                -- aus den Daten, kein Default (Wurzel 4)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists property_service_agreements_property_id_idx
  on public.property_service_agreements (property_id);

-- === Stufe 5: Håndværkere (1:n) ===
-- trade: neutrale Keys 'electrician' | 'plumbing' | 'carpenter' | 'locksmith' | ...
create table if not exists public.property_tradespeople (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  trade text not null,          -- Key
  name text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists property_tradespeople_property_id_idx
  on public.property_tradespeople (property_id);

-- === Stufe 5: Akut-Vollmacht (1:1) ===
-- authority_mode: neutrale Keys 'up_to_amount' | 'always_owner'.
create table if not exists public.property_emergency_authority (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  authority_mode text,          -- Key
  authority_limit numeric(12, 2),
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Stufe 6: Markedsføring (1:1, Prozessdaten) ===
create table if not exists public.property_marketing (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  photographer_booked_at date,
  media_received_at date,
  site_walkthrough_at date,
  defects_list_sent_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Stufe 7: Husmappe (1:1) — nur STATUS, Texte liegen in messaging ===
-- welcome_text_status: neutrale Keys 'received' | 'open'.
create table if not exists public.property_housebook (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  welcome_text_status text,     -- Key
  physical_folder_placed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Stufe 8: Annoncering — Plattform-Matrix & Launch-Status (1:n) ===
-- Grundpreis/Sperrungen NICHT hier (pricing_config/availability/channex sind die Wahrheit).
-- platform: neutrale Keys 'native' | 'airbnb' | 'booking' | 'vrbo' | ...
create table if not exists public.property_platform_launches (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  platform text not null,       -- Key
  launch_at date,
  status text,                  -- Key/Freitext-Status des Onboardings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists property_platform_launches_property_id_idx
  on public.property_platform_launches (property_id);
