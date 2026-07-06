-- 0115_ari_restriction_outbox.sql — Dauerhafter Backstop für Restriktions-Pushes
--
-- Lücke vor diesem Fix: NUR der Availability-Push (0033 ari_outbox) hatte einen
-- persistenten Retry-Backstop. Stop-Sell/Rate/Min-Stay/Max-Stay/CTA-CTD-Pushes
-- (push_stop_sell_for_property, push_rate_for_property, push_max_stay_for_property,
-- push_restrictions_for_property, push_rates_batch) schrieben NICHTS in eine
-- Outbox — bei Channex-Ausfall retryte nur die jobs-Tabelle (max ~10 Versuche,
-- ~7 h), dann ging der Job auf 'dead' → der Wert (z. B. ein Verkaufsstopp) erreichte
-- Channex/OTAs NIE, ohne Selbstheilung → Überbuchung trotz Sperre.
--
-- Diese Tabelle spiegelt das ari_outbox-Muster (0033) für Restriktionen: die
-- push_*-Methoden persistieren ihre ABSICHT (die Parameter zum Neu-Aufbauen des
-- Restriction-Pushes) VOR dem Channex-Call und markieren sie nach Erfolg 'done';
-- bei Fehler bleibt sie 'pending' und der Reconcile-Cron (process_restriction_outbox)
-- zieht sie nach. Persistiert werden die PARAMETER (nicht die aufgelösten Channex-
-- values), damit der Cron das Rate-Plan-Mapping beim Retry NEU auflöst — so heilt
-- sich auch der Fall, dass ein channex-managtes Objekt beim ersten Versuch noch KEINE
-- channex_rate_plan_map-Zeile hatte (Rate-Plan-Import noch nicht gelaufen).
--
-- Idempotent: create type/table/index/policy via if-not-exists bzw. drop-if-exists.

-- Restriktions-Art: bestimmt, welche push_*-Service-Methode der Cron beim Retry
-- neu aufruft und wie das payload interpretiert wird.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ari_restriction_kind') then
    create type public.ari_restriction_kind as enum
      ('stop_sell', 'rate', 'min_stay', 'max_stay', 'cta_ctd', 'restrictions');
  end if;
end
$$;

-- Status-Lebenszyklus: pending → done | failed (analog ari_outbox_status 0033).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ari_restriction_outbox_status') then
    create type public.ari_restriction_outbox_status as enum
      ('pending', 'done', 'failed');
  end if;
end
$$;

create table if not exists public.ari_restriction_outbox (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    property_id  uuid not null references public.properties (id) on delete cascade,
    kind         public.ari_restriction_kind not null,
    -- Parameter zum Neu-Aufbauen des Pushes (kind-spezifisch): z. B. rate_cents,
    -- min_stay, max_stay, closed_to_arrival/departure, stop_sell, days, spans.
    -- Die Channex-Rate-Plans werden beim (Re-)Push NEU aufgelöst (Selbstheilung).
    payload      jsonb not null default '{}'::jsonb,
    date_from    date not null,
    date_to      date not null,             -- inklusiv (Tagesbereich)
    status       public.ari_restriction_outbox_status not null default 'pending',
    attempts     integer not null default 0,
    last_error   text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Cron-Pfad: nur offene Zeilen (partieller Index = schlank).
create index if not exists ari_restriction_outbox_pending_idx
    on public.ari_restriction_outbox (tenant_id, status)
    where status = 'pending';
create index if not exists ari_restriction_outbox_property_idx
    on public.ari_restriction_outbox (property_id);

-- updated_at automatisch pflegen (Konvention wie die Geschwister-Tabellen).
drop trigger if exists trg_ari_restriction_outbox_updated on public.ari_restriction_outbox;
create trigger trg_ari_restriction_outbox_updated
    before update on public.ari_restriction_outbox
    for each row execute function public.set_updated_at();

-- RLS-Pflicht (Memory-Regel: JEDE neue public-Tabelle bekommt RLS). Tenant-Policy
-- wie ari_outbox (0084): anon/authenticated kommen via PostgREST nur an eigene
-- Tenant-Zeilen; Enqueue/Cron laufen über service_role (rolbypassrls) und umgehen
-- die Policy ohnehin. Kein Realtime-Publication-Eintrag (interne Backstop-Tabelle,
-- kein UI-Abo).
alter table public.ari_restriction_outbox enable row level security;
drop policy if exists ari_restriction_outbox_tenant on public.ari_restriction_outbox;
create policy ari_restriction_outbox_tenant on public.ari_restriction_outbox for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
