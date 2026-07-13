-- 0131_channex_debug_log.sql
-- Sichtbares Flow-Debugging für die Channex-Integration (Channel-Manager).
--
-- Jeder echte Channex-HTTP-Call wird als Trace-Zeile persistiert, damit der
-- komplette Zertifizierungs-/OTA-Flow (Property → Room-Type → Rate-Plan → ARI →
-- Channel → Booking) im Frontend live nachvollziehbar ist. Vollständige
-- Request-/Response-Bodies (bewusst, für den Zertifizierungstest) plus die von
-- Channex erzeugte UUID, HTTP-Status, Dauer und Fehler.
--
-- NextDays-Muster: tenant-scoped, RLS via current_tenant_id(), gen_random_uuid()-
-- PK. Realtime (replica identity full + supabase_realtime-Publication) für die
-- Live-Debug-Ansicht. Aufräumen alter Zeilen macht der Slice (Zeitfenster).

create table if not exists public.channex_debug_log (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    -- Optionaler Bezug aufs Objekt (nicht jeder Call hat einen — z. B. Groups).
    property_id    uuid references public.properties(id) on delete set null,
    -- Semantischer Flow-Schritt: property_create/property_update/room_type_create/
    -- rate_plan_create/availability/restrictions/channel_*/booking_*/group_*/… .
    step           text not null,
    -- Roher HTTP-Call (Choke-Point channex_client._request).
    channex_method text not null,                 -- GET|POST|PUT|DELETE
    channex_path   text not null,                 -- z. B. "properties", "room_types"
    request_body   jsonb,                         -- voller Request (kann null sein)
    response_body  jsonb,                         -- volle Antwort (kann null sein)
    -- Von Channex erzeugte UUID des Objekts (data.id), falls vorhanden.
    channex_id     text,
    http_status    integer,                       -- Channex-HTTP-Status
    duration_ms    integer,                       -- Round-Trip-Dauer
    ok             boolean not null default false,-- 2xx?
    error          text,                          -- Fehlermeldung bei !ok
    created_at     timestamptz not null default now()
);

create index if not exists channex_debug_log_tenant_idx
    on public.channex_debug_log(tenant_id, created_at desc);
create index if not exists channex_debug_log_property_idx
    on public.channex_debug_log(property_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — tenant-Isolation (tenant_id = current_tenant_id()).
-- ---------------------------------------------------------------------------
alter table public.channex_debug_log enable row level security;

create policy channex_debug_log_tenant on public.channex_debug_log
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Realtime — Live-Debug-Ansicht abonniert diese Tabelle.
-- replica identity full, damit clientseitige Filter (property_id) greifen.
-- ---------------------------------------------------------------------------
alter table public.channex_debug_log replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'channex_debug_log'
  ) then
    execute 'alter publication supabase_realtime add table public.channex_debug_log';
  end if;
end $$;
