-- 0119_external_calendar.sql — externe iCal-Kalender abonnieren (Belegungs-Sync)
--
-- Der Kunde hinterlegt pro Objekt eine oder mehrere externe iCal-URLs (..,
-- Airbnb, Booking, Vrbo, Google-Kalender …). Ein Worker liest die .ics-Feeds
-- periodisch und traegt die belegten Zeitraeume als availability status='blocked'
-- source='ical' ein → verhindert Doppelbuchungen ueber Plattformen hinweg.
--
-- Das ist KEIN Datenimport (keine Objekte/Preise/Gaeste werden kopiert) — nur
-- Belegungs-Synchronisierung, analog zu ..s "Import Calendar".

-- =========================================================================
-- 1. availability_source um 'ical' erweitern
-- =========================================================================
-- Neuer Enum-Wert: extern abonnierte Sperren sind so von eigenen Buchungen und
-- handischen (manual) Sperren unterscheidbar (Kalender-Filter, Gegenzustand).
alter type public.availability_source add value if not exists 'ical';

-- =========================================================================
-- 2. external_calendar — abonnierte iCal-Feeds pro Objekt
-- =========================================================================
create table if not exists public.external_calendar (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    property_id    uuid not null references public.properties(id) on delete cascade,
    -- Anzeigename (z.B. "..", "Airbnb") + die abonnierte .ics-URL.
    name           text not null,
    ical_url       text not null,
    is_active      boolean not null default true,
    -- Sync-Status fuer die UI (kein stiller Fehler, Wurzel 5): letzter Lauf,
    -- Ergebnis, letzte Fehlermeldung.
    last_synced_at timestamptz,
    last_status    text,               -- ok | error | pending
    last_error     text,
    last_event_count integer,          -- wie viele VEVENTs zuletzt gelesen
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    -- Dieselbe URL nicht doppelt fuer dasselbe Objekt abonnieren (Wurzel 2).
    unique (property_id, ical_url)
);

create index external_calendar_tenant_idx on public.external_calendar (tenant_id);
create index external_calendar_property_idx on public.external_calendar (property_id);
-- Der Worker sucht faellige aktive Feeds → gezielter Teilindex.
create index external_calendar_due_idx
    on public.external_calendar (last_synced_at) where is_active;

create trigger trg_external_calendar_updated
    before update on public.external_calendar
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 3. Herkunft einer ical-Sperre nachhalten (fuer Gegenzustand, Wurzel 1)
-- =========================================================================
-- Damit ein Sync die von IHM gesetzten Sperren gezielt wieder aufraeumen kann,
-- wenn ein Termin im Feed wegfaellt, wird die Quelle (calendar-id) auf der
-- availability-Zeile vermerkt. NULL bei nicht-ical Zeilen.
alter table public.availability
    add column if not exists external_calendar_id uuid
        references public.external_calendar(id) on delete set null;

-- =========================================================================
-- 4. RLS — tenant-scoped Lesezugriff (Schreiben serverseitig via service_role)
-- =========================================================================
alter table public.external_calendar enable row level security;

create policy external_calendar_select on public.external_calendar
    for select
    using (tenant_id = public.current_tenant_id());

-- Der Kunde darf eigene Feeds anlegen/aendern/loeschen (owner-Konto). Schreiben
-- laeuft aber ueber die API (service_role); zusaetzlich hier eine
-- tenant-gescopete Write-Policy als Backstop fuer direkten Zugriff.
create policy external_calendar_write on public.external_calendar
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- =========================================================================
-- 5. Realtime — speist die Kalender-Verwaltungs-UI (Status live)
-- =========================================================================
alter table public.external_calendar replica identity full;
alter publication supabase_realtime add table public.external_calendar;

comment on table public.external_calendar is
  'Abonnierte externe iCal-Feeds pro Objekt (../Airbnb/Booking/Vrbo/Google). '
  'Ein Worker synct sie in availability (blocked, source=ical). Kein Datenimport.';
comment on column public.availability.external_calendar_id is
  'Herkunft einer ical-Sperre → erlaubt gezieltes Aufraeumen bei Feed-Aenderung.';
