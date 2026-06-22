-- 0035_channex_channel_connection.sql
-- Persistiert die OTA-Portal-Verbindung pro (Objekt, Portal).
--
-- Bisher (0027) speichert channex_property_map nur die Channex-Property-UUID,
-- aber NICHT die vom Vermieter eingegebene OTA-Hotel-ID und den bei Channex
-- erzeugten Channel. Folge: die Verbindung ist „blind" — nach dem Verbinden
-- lässt sich die Hotel-ID nicht zurücklesen, der Status pro Portal nicht
-- anzeigen und nicht gezielt trennen/aktualisieren.
--
-- Diese Tabelle schließt genau diese Lücke. Der Vermieter legt seine Unterkunft
-- selbst beim OTA an (z.B. Booking.com), erhält eine Hotel-ID, trägt sie in
-- NextDays ein → wir verbinden über Channex und merken uns die Verbindung hier.
--
-- NextDays-Muster: tenant-scoped, RLS via current_tenant_id(), set_updated_at-
-- Trigger, gen_random_uuid()-PKs.

create table if not exists public.channex_channel_connection (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    property_id         uuid not null references public.properties(id) on delete cascade,
    channex_property_id text not null,                 -- Channex-Property-UUID (Cache)
    ota_portal_code     text not null,                 -- BookingCom|AirBNB|Expedia|VRBO|OpenChannel
    ota_hotel_id        text not null,                 -- Hotel-ID beim OTA (Eingabe des Vermieters)
    channex_channel_id  text,                          -- bei Channex erzeugter Channel (UUID)
    is_active           boolean not null default false, -- Channel aktiviert (live)?
    last_error          text,                          -- letzter Fehler (z.B. Aktivierung fehlgeschlagen)
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists channex_channel_connection_tenant_idx
    on public.channex_channel_connection(tenant_id);
create index if not exists channex_channel_connection_property_idx
    on public.channex_channel_connection(property_id);
-- Pro Objekt+Portal genau eine Verbindung (Re-Connect aktualisiert sie via upsert).
create unique index if not exists channex_channel_connection_property_portal_uidx
    on public.channex_channel_connection(property_id, ota_portal_code);

create trigger trg_channex_channel_connection_updated
    before update on public.channex_channel_connection
    for each row execute function public.set_updated_at();

alter table public.channex_channel_connection enable row level security;

create policy channex_channel_connection_tenant on public.channex_channel_connection
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
