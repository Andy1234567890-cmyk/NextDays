-- 0132_channex_webhook_events.sql
-- Channex-Webhook-Ereignisliste + Hotel-Policy-Verknüpfung.
--
-- 1) channex_webhook_event: persistierte Channex-Webhook-Ereignisse, die eine
--    Operator-Reaktion oder Sichtbarkeit brauchen — Airbnb-Reservierungs-/
--    Änderungsanfragen (reservation_request/alteration_request/inquiry),
--    Sync-/Rate-Fehler, nicht gemappte Buchungen (booking_unmapped_*),
--    nicht bestätigte Buchungen (non_acked_booking), neue Bewertungen und
--    Kanal-Statuswechsel. Hochvolumige Events (ari, message) werden NICHT
--    persistiert (nur als Trigger verarbeitet).
--    Webhooks sind laut Channex-Doku nur Trigger (Reihenfolge nicht garantiert);
--    der payload dient der Anzeige, nie als Datenquelle für Zustandsänderungen.
--
-- 2) channex_property_map.channex_hotel_policy_id: die bei Channex angelegte
--    Hotel Policy des Objekts (Check-in/-out, Haustiere, Parken, Internet,
--    Rauchen) — Pflichtbaustein für Google-Kanal/Instant-Booking-Readiness.
--
-- NextDays-Muster: tenant-scoped, RLS via current_tenant_id(), gen_random_uuid()-
-- PK, Realtime (replica identity full + supabase_realtime-Publication) für die
-- Live-Ereignisliste.

create table if not exists public.channex_webhook_event (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    -- Optionaler Objekt-Bezug (Kanal-/Konto-Events können objektlos sein).
    property_id uuid references public.properties(id) on delete set null,
    -- Channex-Event-Name (reservation_request, sync_error, review, …).
    event       text not null,
    -- Roher Webhook-Payload (Anzeige/Diagnose — NIE Zustandsquelle).
    payload     jsonb,
    -- info | error (error: unmapped/sync_error/rate_error/non_acked/deactivate).
    severity    text not null default 'info',
    -- Vom Operator abgehakt (Anfrage beantwortet, Fehler behoben, …).
    resolved    boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists channex_webhook_event_tenant_idx
    on public.channex_webhook_event(tenant_id, created_at desc);
create index if not exists channex_webhook_event_open_idx
    on public.channex_webhook_event(tenant_id, resolved, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — tenant-Isolation (tenant_id = current_tenant_id()).
-- ---------------------------------------------------------------------------
alter table public.channex_webhook_event enable row level security;

create policy channex_webhook_event_tenant on public.channex_webhook_event
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Realtime — Live-Ereignisliste abonniert diese Tabelle.
-- replica identity full, damit clientseitige Filter (property_id) greifen.
-- ---------------------------------------------------------------------------
alter table public.channex_webhook_event replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'channex_webhook_event'
  ) then
    execute 'alter publication supabase_realtime add table public.channex_webhook_event';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Hotel-Policy-Verknüpfung am Property-Mapping.
-- ---------------------------------------------------------------------------
alter table public.channex_property_map
    add column if not exists channex_hotel_policy_id text;
