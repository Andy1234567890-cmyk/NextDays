-- 0033_ari_outbox.sql — Realtime-Verfügbarkeits-Push an Channex (Outbox + Retry)
--
-- Der Buchungskalender (availability) ist die oberste Wahrheit. Jede Änderung
-- (Buchung, Block, Storno, OTA-Buchung) muss SOFORT die Channex-Verfügbarkeit
-- setzen, damit keine Doppelbuchung über OTAs entsteht. Der Sofort-Push kann bei
-- Channex-Ausfall fehlschlagen — deshalb wird jede Push-Absicht hier persistiert
-- und vom /internal/reconcile-Cron erneut versucht (kein Datenverlust, kein Polling
-- im Buchungspfad). Idempotent: der Push setzt einen absoluten Wert je Tag.

create type public.ari_outbox_status as enum ('pending', 'done', 'failed');

create table public.ari_outbox (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    property_id  uuid not null references public.properties (id) on delete cascade,
    date_from    date not null,
    date_to      date not null,             -- inklusiv (Tagesbereich)
    availability integer not null,          -- absolute Menge je Tag (0 = gesperrt)
    status       public.ari_outbox_status not null default 'pending',
    attempts     integer not null default 0,
    last_error   text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index ari_outbox_pending_idx
    on public.ari_outbox (tenant_id, status)
    where status = 'pending';
create index ari_outbox_property_idx on public.ari_outbox (property_id);
