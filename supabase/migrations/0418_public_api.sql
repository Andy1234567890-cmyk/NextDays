-- 0418_public_api.sql — Fundament der ÖFFENTLICHEN API (apps/public-api)
--
-- Die öffentliche API ist ein eigener Service. Was er über die bestehenden
-- Tabellen hinaus braucht, steht hier:
--
--   public_api_webhooks      Ereignis-Abos eines API-Zugangs (URL + Secret)
--   public_api_events        Warteschlange der Ereignisse (aus DB-Triggern)
--   public_api_deliveries    ein Zustellversuch je (Abo, Ereignis)
--   public_api_idempotency   Wiederholschutz für schreibende Aufrufe
--
-- WARUM DIE EREIGNISSE AUS TRIGGERN KOMMEN und nicht aus dem API-Code: die
-- interessanten Änderungen entstehen NICHT in der öffentlichen API. Eine
-- Booking.com-Buchung kommt über den Portal-Import, eine Stornierung über das
-- Dashboard, eine Preisänderung über einen Hintergrundjob. Ein Ereignis, das nur
-- bei API-Aufrufen feuert, wäre für den Zweck („sag mir, wenn eine Buchung
-- reinkommt") wertlos. Der Trigger sitzt an der Tabelle und sieht damit JEDEN
-- Schreibweg — auch einen, der erst nächstes Jahr dazukommt.
--
-- SICHERHEIT (Wurzel 6): `public_api_webhooks` trägt ein Klartext-Secret (es
-- muss zum Signieren lesbar sein), `public_api_events` trägt Buchungs- und
-- Gastdaten. Beide Tabellen sind deshalb für anon/authenticated vollständig
-- gesperrt — kein Lesen, kein Schreiben. Nur service_role (die beiden Server)
-- arbeitet damit. RLS + Tenant-Policy allein würde NICHT genügen: ein
-- eingeloggter Mitarbeiter mit dem öffentlichen anon-Key könnte sonst per
-- `curl /rest/v1/public_api_webhooks` die Signier-Secrets seines Betriebs lesen
-- und damit beliebige Zustellungen fälschen.

-- =========================================================================
-- Ereignis-Abos
-- =========================================================================
create table if not exists public.public_api_webhooks (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    -- Das Abo gehört einem API-ZUGANG, nicht dem Betrieb als Ganzem: wird der
    -- Zugang widerrufen, hören seine Abos mit auf. Ein Abo, das einen
    -- widerrufenen Zugang überlebt, wäre ein Datenabfluss, den niemand mehr in
    -- der Zugangsliste sieht.
    api_client_id   uuid not null references public.api_clients (id) on delete cascade,
    url             text not null,
    -- Abonnierte Ereignisse. Der Katalog steht im Code
    -- (`apps/public-api/src/v1/schemas.py::EREIGNISSE`) und wird beim Anlegen
    -- geprüft; hier bewusst kein Enum, damit ein neues Ereignis keine Migration
    -- braucht und alte Abos beim Umbenennen nicht ungültig werden.
    events          text[] not null default '{}',
    -- Leeres Array = alle Objekte, auf die der Zugang Zugriff hat.
    property_ids    uuid[] not null default '{}',
    -- KLARTEXT, mit Absicht: der Server muss damit signieren. Genau deshalb ist
    -- die Tabelle für anon/authenticated komplett gesperrt (siehe Kopf).
    secret          text not null,
    revoked_at      timestamptz,
    last_success_at timestamptz,
    last_error      text,
    -- AUFEINANDERFOLGENDE Fehlversuche. Wird bei Erfolg auf 0 zurückgesetzt —
    -- ein Gesamtzähler würde ein gelegentlich wackelndes Abo irgendwann als
    -- dauerhaft kaputt erscheinen lassen.
    failure_count   integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists public_api_webhooks_tenant_idx
    on public.public_api_webhooks (tenant_id);
-- Der Fanout-Pfad: welche aktiven Abos passen zu einem Ereignis?
create index if not exists public_api_webhooks_aktiv_idx
    on public.public_api_webhooks (tenant_id)
    where revoked_at is null;
-- Ein aktives Abo je (Zugang, URL). Backstop zur Prüfung im Code: ohne den
-- Index gewinnen zwei gleichzeitige Anfragen beide und der Empfänger bekommt
-- alles doppelt (Wurzel 2).
create unique index if not exists public_api_webhooks_ziel_uq
    on public.public_api_webhooks (api_client_id, url)
    where revoked_at is null;

create trigger trg_public_api_webhooks_updated
    before update on public.public_api_webhooks
    for each row execute function public.set_updated_at();

-- =========================================================================
-- Ereignis-Warteschlange
-- =========================================================================
create table if not exists public.public_api_events (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    event       text not null,
    -- Objekt, auf das sich das Ereignis bezieht. NULL bei Ereignissen ohne
    -- Objektbezug; die Objekt-Beschränkung eines Abos kann dann nicht greifen,
    -- und solche Ereignisse gehen nur an Abos ohne Beschränkung.
    property_id uuid references public.properties (id) on delete cascade,
    -- Die Nutzlast, die der Empfänger sieht. Bewusst schmal gehalten: IDs und
    -- die Felder, die die Änderung beschreiben. Wer mehr braucht, holt die
    -- Ressource über die API — ein Webhook, der ganze Datensätze verschickt,
    -- verschickt sie auch dann, wenn der Empfänger sie nicht mehr sehen dürfte.
    payload     jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);

create index if not exists public_api_events_tenant_idx
    on public.public_api_events (tenant_id, created_at desc);

comment on table public.public_api_events is
  'Warteschlange der Ereignisse der oeffentlichen API. Gefuellt aus '
  'DB-Triggern (jeder Schreibweg, nicht nur die API), gelesen vom Zusteller '
  'in apps/public-api/src/zusteller.';

-- =========================================================================
-- Zustellversuche
-- =========================================================================
create table if not exists public.public_api_deliveries (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    webhook_id      uuid not null references public.public_api_webhooks (id) on delete cascade,
    event_id        uuid not null references public.public_api_events (id) on delete cascade,
    -- pending → delivered | failed | cancelled
    status          text not null default 'pending',
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    response_status integer,
    last_error      text,
    delivered_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint public_api_deliveries_status_chk
        check (status in ('pending', 'delivered', 'failed', 'cancelled'))
);

-- EINE Zustellung je (Abo, Ereignis). Das ist der Backstop gegen doppelte
-- Zustellung: der Takt des Zustellers kann sich überlappen (langsamer
-- Empfänger, zwei Container), und eine Prüfung im Code hat immer ein Rennen.
create unique index if not exists public_api_deliveries_eindeutig_uq
    on public.public_api_deliveries (webhook_id, event_id);
-- Der Abholpfad des Zustellers: nur fällige, offene Zustellungen.
create index if not exists public_api_deliveries_faellig_idx
    on public.public_api_deliveries (next_attempt_at)
    where status = 'pending';

create trigger trg_public_api_deliveries_updated
    before update on public.public_api_deliveries
    for each row execute function public.set_updated_at();

-- =========================================================================
-- Wiederholschutz (Idempotency-Key)
-- =========================================================================
create table if not exists public.public_api_idempotency (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references public.tenants (id) on delete cascade,
    api_client_id        uuid not null references public.api_clients (id) on delete cascade,
    idempotency_key      text not null,
    -- Hash über Pfad + Nutzlast. Damit lässt sich „derselbe Aufruf nochmal"
    -- von „derselbe Schlüssel für einen ANDEREN Vorgang" unterscheiden —
    -- Letzteres ist ein Fehler im Client und wird mit 422 gemeldet, nicht
    -- stillschweigend als „schon erledigt" quittiert.
    request_fingerprint  text not null,
    pfad                 text not null,
    -- NULL, solange der erste Aufruf noch läuft. Eine Wiederholung bekommt in
    -- diesem Zustand einen 409 „läuft noch" — nicht eine zweite Ausführung.
    response_status      integer,
    response_body        jsonb,
    created_at           timestamptz not null default now()
);

-- Der eigentliche Schutz: der Anspruch entsteht als INSERT, und dieser Index
-- entscheidet das Rennen. Zwei gleichzeitige POSTs mit demselben Schlüssel
-- ergeben damit eine Ausführung und einen Verweis auf sie.
create unique index if not exists public_api_idempotency_uq
    on public.public_api_idempotency (api_client_id, idempotency_key);
create index if not exists public_api_idempotency_alter_idx
    on public.public_api_idempotency (created_at);

comment on table public.public_api_idempotency is
  'Wiederholschutz der oeffentlichen API. Zeilen aelter als 24 h werden von '
  'einem Aufraeumjob entfernt; danach gilt ein Schluessel wieder als neu.';

-- =========================================================================
-- Fanout: Ereignis → Zustellungen
-- =========================================================================
create or replace function public.public_api_fanout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Je passendes aktives Abo eine Zustellung. `on conflict do nothing` macht
    -- den Fanout wiederholbar: läuft er durch einen Retry zweimal, entsteht
    -- keine zweite Zustellung (Wurzel 2).
    insert into public.public_api_deliveries (tenant_id, webhook_id, event_id)
    select w.tenant_id, w.id, new.id
      from public.public_api_webhooks w
     where w.tenant_id = new.tenant_id
       and w.revoked_at is null
       and new.event = any (w.events)
       and (
            -- Abo ohne Objekt-Beschränkung bekommt alles.
            cardinality(w.property_ids) = 0
            -- Sonst nur, wenn das Ereignis ein Objekt nennt UND es dazugehört.
            -- Ein Ereignis ohne Objekt geht NICHT an ein beschränktes Abo: der
            -- Empfänger könnte nicht entscheiden, ob es ihn betrifft.
            or (new.property_id is not null and new.property_id = any (w.property_ids))
       )
    on conflict (webhook_id, event_id) do nothing;
    return new;
end;
$$;

revoke execute on function public.public_api_fanout() from anon, authenticated;

create trigger trg_public_api_fanout
    after insert on public.public_api_events
    for each row execute function public.public_api_fanout();

-- =========================================================================
-- Ereignisse erzeugen
-- =========================================================================
-- Ein Ereignis wird nur geschrieben, wenn es überhaupt ein Abo dafür gibt.
-- Ohne diese Prüfung füllte jede Buchung des ganzen Systems eine Tabelle, die
-- niemand liest — bei einem Betrieb ohne Integration wäre das reine Last.
create or replace function public.public_api_ereignis(
    p_tenant_id uuid,
    p_event text,
    p_property_id uuid,
    p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1 from public.public_api_webhooks w
         where w.tenant_id = p_tenant_id
           and w.revoked_at is null
           and p_event = any (w.events)
    ) then
        return;
    end if;
    insert into public.public_api_events (tenant_id, event, property_id, payload)
    values (p_tenant_id, p_event, p_property_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke execute on function public.public_api_ereignis(uuid, text, uuid, jsonb)
    from anon, authenticated;

-- -- Buchungen ------------------------------------------------------------
create or replace function public.public_api_trg_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event text;
begin
    if tg_op = 'INSERT' then
        v_event := 'reservation.created';
    elsif new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
        -- Storno ist ein EIGENES Ereignis, nicht „updated". Ein Empfänger, der
        -- eine Reinigung plant, muss darauf anders reagieren als auf eine
        -- geänderte Gästezahl.
        v_event := 'reservation.cancelled';
    else
        v_event := 'reservation.updated';
    end if;

    perform public.public_api_ereignis(
        new.tenant_id,
        v_event,
        new.property_id,
        jsonb_build_object(
            'reservation_id', new.id,
            'property_id', new.property_id,
            'unit_id', new.unit_id,
            'status', new.status,
            'channel', new.channel,
            'check_in', new.check_in,
            'check_out', new.check_out,
            -- Der Zeitpunkt der Buchung DES GASTES, aus der Quelle. Kann NULL
            -- sein; dann weiß der Empfänger, dass wir ihn nicht kennen. NIE
            -- durch `created_at` ersetzen — unsere Uhr ist nicht der Zeitpunkt
            -- einer fremden Handlung (Wurzel 5b).
            'booked_at', new.booked_at,
            'received_at', new.created_at
        )
    );
    return new;
end;
$$;

revoke execute on function public.public_api_trg_reservations() from anon, authenticated;

create trigger trg_public_api_reservations
    after insert or update on public.reservations
    for each row execute function public.public_api_trg_reservations();

-- -- Kalender -------------------------------------------------------------
create or replace function public.public_api_trg_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_tenant uuid;
begin
    -- Nur bei echtem Statuswechsel. Ohne diese Bedingung feuerte jeder
    -- `updated_at`-Anfasser ein Ereignis, und ein Massen-Upsert über ein Jahr
    -- erzeugte 365 Zustellungen für eine Änderung, die niemanden interessiert.
    if tg_op = 'UPDATE' and new.status = old.status then
        return new;
    end if;
    -- `availability` trägt keine tenant_id (sie hängt am Objekt).
    select p.tenant_id into v_tenant
      from public.properties p where p.id = new.property_id;
    if v_tenant is null then
        return new;
    end if;
    perform public.public_api_ereignis(
        v_tenant,
        'availability.changed',
        new.property_id,
        jsonb_build_object(
            'property_id', new.property_id,
            'unit_id', new.unit_id,
            'date', new.date,
            'status', new.status
        )
    );
    return new;
end;
$$;

revoke execute on function public.public_api_trg_availability() from anon, authenticated;

create trigger trg_public_api_availability
    after insert or update on public.availability
    for each row execute function public.public_api_trg_availability();

-- -- Preise ---------------------------------------------------------------
create or replace function public.public_api_trg_rate_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_tenant uuid;
    v_property uuid;
begin
    select p.tenant_id, p.id into v_tenant, v_property
      from public.rate_plans rp
      join public.properties p on p.id = rp.property_id
     where rp.id = coalesce(new.rate_plan_id, old.rate_plan_id);
    if v_tenant is null then
        return coalesce(new, old);
    end if;
    perform public.public_api_ereignis(
        v_tenant,
        'rate.changed',
        v_property,
        jsonb_build_object(
            'property_id', v_property,
            'rate_plan_id', coalesce(new.rate_plan_id, old.rate_plan_id),
            'date', coalesce(new.date, old.date),
            -- Beim Löschen eines Tagespreises ist der neue Zustand „kein
            -- Tagespreis" — als NULL, nicht als 0. Eine 0 hieße „kostenlos".
            'price', case when tg_op = 'DELETE' then null else new.price end
        )
    );
    return coalesce(new, old);
end;
$$;

revoke execute on function public.public_api_trg_rate_price() from anon, authenticated;

create trigger trg_public_api_rate_price
    after insert or update or delete on public.rate_plan_price_overrides
    for each row execute function public.public_api_trg_rate_price();

-- -- Aufgaben -------------------------------------------------------------
create or replace function public.public_api_trg_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event text;
begin
    if tg_op = 'INSERT' then
        v_event := 'task.created';
    elsif new.status = 'done' and coalesce(old.status, '') <> 'done' then
        v_event := 'task.completed';
    else
        -- Andere Änderungen an einer Aufgabe haben (noch) kein Ereignis. Es
        -- eines der beiden vorhandenen unterzuschieben wäre schlimmer als
        -- keines: der Empfänger würde eine verschobene Fälligkeit als
        -- „erledigt" verbuchen.
        return new;
    end if;
    perform public.public_api_ereignis(
        new.tenant_id,
        v_event,
        new.property_id,
        jsonb_build_object(
            'task_id', new.id,
            'property_id', new.property_id,
            'reservation_id', new.reservation_id,
            'title', new.title,
            'status', new.status,
            'assignee_id', new.assignee_id,
            'due_at', new.due_at
        )
    );
    return new;
end;
$$;

revoke execute on function public.public_api_trg_tasks() from anon, authenticated;

create trigger trg_public_api_tasks
    after insert or update on public.tasks
    for each row execute function public.public_api_trg_tasks();

-- =========================================================================
-- Wurzel 6 — RLS + harter GRANT-Entzug
-- =========================================================================
-- Alle vier Tabellen sind Server-Tabellen. Sie tragen Signier-Secrets,
-- Buchungsdaten und gespeicherte Antworten; kein Client hat dort etwas zu
-- suchen. Die restriktive Tenant-Policy ist der Backstop, falls je ein GRANT
-- dazukommt — sie greift `for all`, nicht nur `for select`, damit auch der
-- SCHREIB-Pfad geschlossen ist.
alter table public.public_api_webhooks enable row level security;
alter table public.public_api_events enable row level security;
alter table public.public_api_deliveries enable row level security;
alter table public.public_api_idempotency enable row level security;

create policy public_api_webhooks_tenant on public.public_api_webhooks
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy public_api_events_tenant on public.public_api_events
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy public_api_deliveries_tenant on public.public_api_deliveries
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy public_api_idempotency_tenant on public.public_api_idempotency
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.public_api_webhooks from anon, authenticated;
revoke select, insert, update, delete on public.public_api_events from anon, authenticated;
revoke select, insert, update, delete on public.public_api_deliveries from anon, authenticated;
revoke select, insert, update, delete on public.public_api_idempotency from anon, authenticated;

comment on column public.public_api_webhooks.secret is
  'Signier-Secret im Klartext (der Server MUSS damit signieren). Genau deshalb '
  'ist die Tabelle fuer anon/authenticated vollstaendig gesperrt.';
