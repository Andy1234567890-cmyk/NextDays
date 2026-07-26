-- Co-Gastgeber (Airbnb „Co-Hosts") für den Plattform-Marktplatz.
--
-- ABGRENZUNG — das ist der Kern und darf nicht verwechselt werden:
--
--   • apps/web (PMS/CM, Abo-Modell) hat TEAMS: users mit Rolle im EIGENEN
--     Tenant (co_admin/staff/cleaner), Objektzuordnung über
--     staff_property_assignments. Entspricht Airbnbs „Hosting Teams" —
--     laut deren Doku ausdrücklich für „professional hosts, property
--     management companies, teams".
--   • plattform/ (Marktplatz, 8 % Fee) bekommt CO-GASTGEBER: eine Person mit
--     EIGENEM Tenant, die auf einem FREMDEN Objekt mithilft. Entspricht
--     Airbnbs „Co-Hosts" (max. 10 je Listing) — für Einzelvermieter ohne Team.
--
-- Deshalb eine eigene Tabelle statt users.tenant_id: Ein Co-Gastgeber ist
-- selbst Gastgeber und hat eigene Objekte. Würde man ihn in den Tenant des
-- Eigentümers stecken, bräuchte dieselbe Person zwei Konten und könnte nicht
-- zwischen „meine Objekte" und „mitbetreute" wechseln.
--
-- QUELLEN (airbnb.com/help/article/1534, /1243, /3264, /2513, abgerufen
-- 2026-07-26): drei Zugriffsstufen; max. 10 je Objekt; Identitätsprüfung vor
-- Annahme; ein Vollzugriff-Co-Host darf weitere NUR mit eingeschränktem
-- Zugriff einladen; Auszahlungsdaten richtet ausschließlich der Eigentümer
-- ein; beim Entfernen entfällt jeder Zugriff sofort.

-- --- Zugriffsstufen ---------------------------------------------------------
-- Genau die drei Stufen von Airbnb. Als Enum, damit ein Tippfehler nicht
-- stillschweigend zu „keine Rechte" oder „alle Rechte" führt (Wurzel 4).
create type cohost_access as enum (
    'full',              -- Objekt+Preise verwalten, Buchungen, Kalender, Nachrichten
    'calendar_messaging',-- Kalender SEHEN (nicht ändern) + mit Gästen schreiben
    'calendar'           -- nur Kalender sehen
);

create type cohost_status as enum (
    'pending',   -- eingeladen, noch nicht angenommen
    'active',    -- angenommen, Zugriff läuft
    'declined',  -- abgelehnt
    'revoked'    -- vom Eigentümer entfernt / selbst ausgetreten
);

-- --- Zuordnung Objekt ↔ Co-Gastgeber ---------------------------------------
create table public.property_cohosts (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    -- Der Co-Gastgeber. Referenz auf auth.users, NICHT auf public.users:
    -- er gehört einem anderen Tenant an (oder legt seinen bei der Annahme an).
    user_id uuid not null references auth.users(id) on delete cascade,
    -- Tenant des OBJEKTS (nicht des Co-Gastgebers). Für Auswertungen und damit
    -- der Eigentümer seine Co-Gastgeber ohne Join über properties findet.
    owner_tenant_id uuid not null references public.tenants(id) on delete cascade,
    access cohost_access not null,
    status cohost_status not null default 'pending',
    -- Wer eingeladen hat. Für die Airbnb-Regel „ein Vollzugriff-Co-Host darf
    -- weitere nur eingeschränkt einladen" und für die Nachvollziehbarkeit.
    invited_by uuid not null references auth.users(id) on delete cascade,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    accepted_at timestamptz,
    revoked_at timestamptz,
    -- Eine Person je Objekt nur EINMAL. Doppelklick/Retry auf „einladen" darf
    -- keine zweite Zeile erzeugen (Wurzel 2: UNIQUE als Backstop).
    unique (property_id, user_id)
);

comment on table public.property_cohosts is
    'Co-Gastgeber je Objekt (Plattform-Marktplatz). Der Co-Gastgeber hat einen '
    'EIGENEN Tenant — deshalb eigene Tabelle statt users.tenant_id. Max. 10 je '
    'Objekt, im Service erzwungen.';

create index property_cohosts_property_idx
    on public.property_cohosts (property_id) where status = 'active';
create index property_cohosts_user_idx
    on public.property_cohosts (user_id) where status = 'active';
create index property_cohosts_tenant_idx
    on public.property_cohosts (owner_tenant_id);

-- --- Einladungen ------------------------------------------------------------
-- Getrennt von property_cohosts, weil eine Einladung an eine E-MAIL geht — der
-- Empfänger hat u. U. noch gar kein Konto. Erst bei der Annahme entsteht die
-- Zuordnung oben.
create table public.cohost_invitations (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    owner_tenant_id uuid not null references public.tenants(id) on delete cascade,
    email text not null,
    access cohost_access not null,
    note text,
    -- Nur der HASH des Tokens. Ein Leak der Tabelle darf keine gültigen
    -- Einladungslinks preisgeben; verglichen wird byteweise (core.security).
    token_hash text not null,
    invited_by uuid not null references auth.users(id) on delete cascade,
    expires_at timestamptz not null,
    accepted_at timestamptz,
    accepted_by uuid references auth.users(id) on delete set null,
    declined_at timestamptz,
    created_at timestamptz not null default now()
);

comment on table public.cohost_invitations is
    'Offene Co-Gastgeber-Einladungen. Speichert nur den Token-HASH. Läuft ab '
    '(expires_at); die Annahme erzeugt die Zeile in property_cohosts.';

create unique index cohost_invitations_token_idx
    on public.cohost_invitations (token_hash);
-- Nur EINE offene Einladung je Objekt+E-Mail (Wurzel 2).
create unique index cohost_invitations_offen_idx
    on public.cohost_invitations (property_id, lower(email))
    where accepted_at is null and declined_at is null;

-- --- Scope-Helper -----------------------------------------------------------
-- Sieht der aktuelle Nutzer dieses Objekt als Co-Gastgeber?
--
-- SECURITY DEFINER, weil property_cohosts für anon/authenticated gesperrt ist
-- (siehe revoke unten) — eine normale Policy könnte dort nicht nachschlagen.
-- Gibt nur einen Boolean zurück, nie Daten. Fail-closed.
--
-- Bewusst OHNE tenant-Prüfung, anders als owner_can_see_property: Der
-- Co-Gastgeber gehört per Definition einem ANDEREN Tenant an. Genau das ist
-- der Unterschied zum Team-Modell.
create or replace function public.is_cohost_of(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.property_cohosts c
        where c.property_id = p_property_id
          and c.user_id = (select auth.uid())
          and c.status = 'active'
    )
$$;

comment on function public.is_cohost_of(uuid) is
    'True, wenn der aktuelle Nutzer aktiver Co-Gastgeber dieses Objekts ist. '
    'Ohne tenant-Prüfung — ein Co-Gastgeber ist tenant-fremd. Fail-closed.';

revoke execute on function public.is_cohost_of(uuid) from anon, authenticated;

-- Zugriffsstufe des aktuellen Nutzers auf ein Objekt (null = kein Co-Gastgeber).
-- Für Policies, die zwischen „darf sehen" und „darf ändern" unterscheiden.
create or replace function public.cohost_access_of(p_property_id uuid)
returns public.cohost_access
language sql
stable
security definer
set search_path = ''
as $$
    select c.access
    from public.property_cohosts c
    where c.property_id = p_property_id
      and c.user_id = (select auth.uid())
      and c.status = 'active'
    limit 1
$$;

revoke execute on function public.cohost_access_of(uuid) from anon, authenticated;

-- --- RLS (Wurzel 6) ---------------------------------------------------------
-- Beide Tabellen steuern ZUGRIFF auf fremde Objekte — wer hier schreiben kann,
-- verschafft sich Zugriff. Deshalb: Schreiben ausschließlich über den Server
-- (service_role), der die Airbnb-Regeln erzwingt (max. 10, Vollzugriff darf
-- keinen Vollzugriff vergeben, nur der Eigentümer darf entfernen).
alter table public.property_cohosts enable row level security;
alter table public.cohost_invitations enable row level security;

revoke insert, update, delete on public.property_cohosts
    from anon, authenticated;
revoke insert, update, delete on public.cohost_invitations
    from anon, authenticated;
-- Einladungen enthalten Token-Hashes und E-Mail-Adressen — für Clients
-- vollständig gesperrt, auch lesend. Der Server liefert sie gefiltert aus.
revoke select on public.cohost_invitations from anon, authenticated;

-- Lesen von property_cohosts: der Eigentümer-Tenant (seine Co-Gastgeber) und
-- der Co-Gastgeber selbst (seine Zuordnungen). Sonst niemand.
create policy property_cohosts_read
    on public.property_cohosts
    for select
    using (
        owner_tenant_id = public.current_tenant_id()
        or user_id = (select auth.uid())
    );

-- Realtime: Die Co-Gastgeber-Liste im Objekt-Editor aktualisiert live, wenn
-- eine Einladung angenommen oder ein Zugriff entzogen wird.
grant select on public.property_cohosts to authenticated;
alter publication supabase_realtime add table public.property_cohosts;
