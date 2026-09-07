-- 0583_events_objektzuweisung_realtime.sql — Sonder-Events bekommen einen
-- Schreibpfad (Lastenheft §2.3): Objektzuweisung, Realtime, Farbform.
--
-- BEFUND (07.09.2026, docs/REQUIREMENTS-GAP.md §2.3): `events`/`event_periods`
-- (0011) werden seit 0011 vom Dynamic Pricing gelesen
-- (`pricing/recompute.py::_event_pct_by_date`, `engine.py::_merged_event_pct`),
-- hatten aber weder Endpunkt noch Oberfläche — ein Event ließ sich nur per
-- DB anlegen. Und es wirkte immer TENANT-WEIT auf jedes Objekt: die „DANA
-- CUP" in Hjørring hob damit auch den Preis eines Hauses auf Bornholm.
--
-- Diese Migration ergänzt, was der Schreibpfad braucht:
--
-- 1) `event_property_assignments` — WELCHE Objekte ein Event betrifft. Leer =
--    alle Objekte des Mandanten (dasselbe Muster wie `task_rules.property_ids`
--    leer = alle, 0012). Ein Event „Silvester" gilt überall, „DANA CUP" nur
--    für die Häuser in Reichweite.
-- 2) Realtime-Publikation für alle drei Tabellen: die Event-Verwaltung im
--    Saison-Kalender abonniert sie. Ohne Publikation wäre das Abo eine stumme
--    Attrappe (0234: „select, aber NICHT publiziert").
-- 3) Farbform: `events.color` war freier Text. Die Kalenderzelle setzt den
--    Wert als CSS-Farbe — `#RRGGBB` oder nichts (wie property_seasons.color,
--    0138). `not valid`, weil Altbestand nicht geprüft werden muss (0053: nie
--    per UI befüllt); neue Schreibvorgänge prüft der CHECK.
--
-- RLS/Grants (Wurzel 6): `events` trägt seit 0015 die tenant-Policy und seit
-- 0224 die restriktive Schreib-Policy plus revoke; `event_periods` seit 0015
-- die via-event-Policy und seit 0224/0337 den revoke. Die neue Tabelle bekommt
-- dasselbe: RLS via event → tenant, revoke für Schreibrichtung (nur der
-- Server schreibt), SELECT für authenticated (Realtime + Lesen, RLS scopt).
--
-- KEIN `begin;`/`commit;` — apply-migrations.sh fährt jede Datei in einer
-- eigenen Transaktion (0576).

-- 1) Objektzuweisung ---------------------------------------------------------
create table if not exists public.event_property_assignments (
    id          uuid primary key default gen_random_uuid(),
    event_id    uuid not null references public.events (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (event_id, property_id)
);

create index if not exists event_property_assignments_property_idx
    on public.event_property_assignments (property_id);

alter table public.event_property_assignments enable row level security;

drop policy if exists event_property_assignments_via_event
    on public.event_property_assignments;
create policy event_property_assignments_via_event
  on public.event_property_assignments
  for all using (exists (
    select 1 from public.events e
    where e.id = event_property_assignments.event_id
      and e.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.events e
    where e.id = event_property_assignments.event_id
      and e.tenant_id = public.current_tenant_id()));

-- Nur der Server (service_role) schreibt; der Direktpfad bleibt lesend.
revoke insert, update, delete on public.event_property_assignments
    from anon, authenticated;
grant select on public.event_property_assignments to authenticated;

comment on table public.event_property_assignments is
    'Objekte, für die ein Sonder-Event (events) gilt. KEINE Zeile für ein '
    'Event = es gilt für alle Objekte des Mandanten (Muster task_rules.'
    'property_ids leer = alle). Gelesen von pricing/recompute.py.';

-- 2) Farbform ---------------------------------------------------------------
alter table public.events
    drop constraint if exists events_color_form;
alter table public.events
    add constraint events_color_form
    check (color is null or color ~ '^#[0-9a-fA-F]{6}$') not valid;

-- Der Name wird in Legende und Zelle gezeigt — leer oder endlos ist beides
-- kein Name. Dieselbe Grenze wie property_seasons.name (0138).
alter table public.events
    drop constraint if exists events_name_form;
alter table public.events
    add constraint events_name_form
    check (char_length(name) between 1 and 80) not valid;

-- Lesen für den Kalender (Realtime braucht das Tabellen-Grant; RLS entscheidet
-- dann, welche Zeilen). Beide hatten es über die Supabase-Default-Privilegien
-- bereits — ausdrücklich gesetzt, damit die Zusage in der Migration steht und
-- nicht in einer Voreinstellung.
grant select on public.events to authenticated;
grant select on public.event_periods to authenticated;

-- 3) Realtime-Publikation ---------------------------------------------------
-- `add table` ist nicht idempotent → je Tabelle vorher prüfen (Muster 0234).
do $$
declare
    t text;
begin
    foreach t in array array[
        'events', 'event_periods', 'event_property_assignments'
    ]
    loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public'
              and tablename = t
        ) then
            execute format(
                'alter publication supabase_realtime add table public.%I', t
            );
        end if;
    end loop;
end
$$;

comment on table public.events is
    'Sonder-Events des Mandanten (Name, Aufschlag %, Farbe) mit n auch '
    'unterbrochenen Zeiträumen (event_periods) und optionaler Objektzuweisung '
    '(event_property_assignments, 0583). Fließen als Event-Faktor in das '
    'Dynamic Pricing (pricing/recompute.py). Schreibpfad: '
    'GET/POST/PATCH/DELETE /calendar/events. In supabase_realtime (0583).';
