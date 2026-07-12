-- 0122_reservation_events.sql — Ereignis-Zeitleiste je Buchung (Lodgify „Zeitleiste").
--
-- Append-only Ereignis-Log einer Reservierung: „Buchung erstellt", „verschoben",
-- „Preis neu berechnet", „eingecheckt", „ausgecheckt", „storniert", „Aufgabe
-- erstellt". Jede schreibende Reservierungs-Aktion hinterlässt genau eine Zeile.
-- Der Slider/Detailbereich liest sie live (Realtime) und zeigt sie chronologisch.
--
-- Muster wie reservation_cancellation_log (0050) / inbox_assignment_log (0045):
-- denormalisierte Felder am Datensatz + eigene append-only Tabelle, tenant-scoped
-- RLS (Service-Role umgeht RLS → der Service scopet zusätzlich, Wurzel 3).
-- Basis-Events für Altbuchungen (created_at/checked_in_at/…) werden NICHT hier
-- nachgetragen, sondern im Lesepfad synthetisiert (kein Backfill nötig).

create table if not exists public.reservation_events (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    reservation_id uuid not null references public.reservations(id) on delete cascade,
    -- Ereignis-Art (stabiler Schlüssel; die Beschriftung/Übersetzung macht das UI):
    --   created | moved | repriced | checked_in | checked_out | cancelled
    --   | task_created
    kind           text not null,
    -- Wer die Aktion ausgelöst hat (System-/Webhook-Events: null).
    by_user_id     uuid references public.users(id) on delete set null,
    -- Frei strukturierte Detaildaten der Aktion (z. B. alt/neu-Objekt beim Move,
    -- alter/neuer Preis beim Reprice, Aufgaben-Titel). Keine sensiblen Rohwerte —
    -- Beträge werden erst im Lesepfad maskiert.
    detail         jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now()
);
create index if not exists reservation_events_res_idx
    on public.reservation_events(reservation_id, created_at);
create index if not exists reservation_events_tenant_idx
    on public.reservation_events(tenant_id, created_at);

-- RLS — tenant-scoped (Muster 0050). Jede neue public-Tabelle bekommt RLS
-- (anon hat pauschale Grants, RLS ist der einzige Backstop).
alter table public.reservation_events enable row level security;

create policy reservation_events_tenant on public.reservation_events
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Realtime: die Zeitleiste im Slider/Detail abonniert diese Tabelle live
-- (idempotenter Guard, Muster 0048/0120/0121).
do $$
declare
  t text;
  tables text[] := array['reservation_events'];
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
