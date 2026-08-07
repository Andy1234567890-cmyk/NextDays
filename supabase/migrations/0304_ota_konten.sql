-- OTA-Konten als eigene Entität: ein Betrieb kann MEHRERE Konten je Portal
-- führen (Agenturen betreuen hunderte Vermieter mit je eigenem Airbnb-,
-- Booking- oder Vrbo-Zugang).
--
-- WARUM EINE EIGENE TABELLE
--
-- Bisher steckte das Konto in `channex_channel_connection`: `channex_channel_id`
-- und `ota_hotel_id` standen in JEDER Objektzeile wieder (live: 19-mal derselbe
-- Kanal). Damit gab es keinen Ort für die Angaben, die dem KONTO gehören und
-- nicht dem Objekt — Anzeigename, Verbindungszeitpunkt, Token-Zustand — und
-- keine Möglichkeit, ein Konto zu benennen oder gezielt zu trennen.
--
-- Channex modelliert es genauso (Doku `channel-mapping-guides/airbnb.md`,
-- 07.08.2026 gelesen): „A channel is created per host account rather than per
-- individual property … you choose which properties will connect to the
-- channel." Und: „Host ID … once connection is active it will show the Host ID
-- here." Ein Kanal = ein Konto, viele Objekte darunter. Live gegengeprüft:
-- Kanal 9a46827b-… trägt alle 19 Objekte des Beta-Betriebs.
--
-- Die Tabelle bildet also ab, was bei Channex ohnehin schon so ist — sie ist
-- kein neues Konzept, sondern der fehlende Name für ein vorhandenes.

create table if not exists public.ota_account (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Portal-Code wie in `channex_channel_connection.ota_portal_code`
    -- ("AirBNB", "BookingCom", "Vrbo") — dieselbe Schreibweise, damit beide
    -- Tabellen ohne Übersetzungstabelle zusammenpassen.
    ota_portal_code text not null,
    -- Der Kanal bei Channex. NULL, solange er noch nicht angelegt ist (der
    -- Nutzer hat „Konto verbinden" gedrückt, die Autorisierung läuft noch).
    channex_channel_id text,
    -- Die Kennung des Kontos beim Portal: Airbnb-Host-ID, Booking-Hotel-ID.
    -- Bei Airbnb erst NACH der Autorisierung bekannt (Channex: „This will be
    -- empty, once connection is active it will show the Host ID here").
    ota_hotel_id text,
    -- Name für die Liste. Der Betrieb vergibt ihn; bei 100 Konten ist
    -- „226976381" keine Auskunft, „Torsten Nord" schon. Fehlt er, zeigt die
    -- Oberfläche die Kennung — kein erfundener Name (Wurzel 4).
    display_name text,
    -- Verbindungszustand. `token_invalid` = Channex meldet abgelaufene Tokens,
    -- der Betrieb muss neu autorisieren.
    is_active boolean not null default true,
    token_invalid boolean not null default false,
    last_error text,
    connected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Ein Channex-Kanal gehört zu GENAU einem Konto. Ohne das könnten zwei
-- Kontozeilen denselben Kanal beanspruchen und jeder Push liefe je nach
-- Lesereihenfolge woanders hin.
create unique index if not exists ota_account_channel_uidx
    on public.ota_account (channex_channel_id)
    where channex_channel_id is not null;

-- Dasselbe Portal-Konto nicht zweimal beim selben Betrieb. Greift erst, sobald
-- die Kennung bekannt ist (bei Airbnb nach der Autorisierung) — vorher sind
-- mehrere angefangene Verbindungen zulässig.
create unique index if not exists ota_account_hotel_uidx
    on public.ota_account (tenant_id, ota_portal_code, ota_hotel_id)
    where ota_hotel_id is not null;

create index if not exists ota_account_tenant_idx
    on public.ota_account (tenant_id, ota_portal_code);

-- Die Verbindung zeigt auf ihr Konto. `on delete set null` statt `cascade`:
-- ein gelöschtes Konto darf die Objektzuordnung nicht mitnehmen, sonst
-- verschwindet stillschweigend die Zeile, die den Verkauf steuert.
alter table public.channex_channel_connection
    add column if not exists ota_account_id uuid
        references public.ota_account (id) on delete set null;

create index if not exists channex_channel_connection_account_idx
    on public.channex_channel_connection (ota_account_id);

-- BESTAND ÜBERNEHMEN: je vorhandenem Kanal ein Konto anlegen und die
-- Verbindungen daran hängen. Live steht dort genau ein echter Kanal
-- (AirBNB / 9a46827b-… / Host 529591717 / 19 Objekte); die Demo-Tenants tragen
-- `demo-airbnb` ohne Kanal und bekommen deshalb keins.
insert into public.ota_account
    (tenant_id, ota_portal_code, channex_channel_id, ota_hotel_id, is_active, connected_at)
select distinct on (c.channex_channel_id)
       c.tenant_id, c.ota_portal_code, c.channex_channel_id, c.ota_hotel_id,
       true, c.created_at
  from public.channex_channel_connection c
 where c.channex_channel_id is not null
 order by c.channex_channel_id, c.created_at
on conflict do nothing;

update public.channex_channel_connection c
   set ota_account_id = a.id
  from public.ota_account a
 where a.channex_channel_id = c.channex_channel_id
   and c.channex_channel_id is not null
   and c.ota_account_id is null;

-- DEN BLOCKER LÖSEN: „genau EINE objektlose Verbindung je Betrieb und Portal"
-- (0282) war richtig, solange es ein Konto gab — es verhinderte doppelte Kanäle
-- bei wiederholtem Klick (Wurzel 2). Mit mehreren Konten ist es zu eng: ein
-- zweites Airbnb-Konto ohne Objekt ließe sich physisch nicht speichern.
--
-- Der Schutz bleibt, er wird nur genauer: eindeutig ist jetzt (Betrieb, Portal,
-- KONTO). Ein zweiter Klick auf dasselbe Konto läuft weiterhin in den Konflikt,
-- ein zweites Konto ist erlaubt.
drop index if exists public.channex_channel_connection_account_uidx;

create unique index if not exists channex_channel_connection_account_uidx
    on public.channex_channel_connection (tenant_id, ota_portal_code, ota_account_id)
    where property_id is null;

-- Ein Objekt kann an mehreren Konten desselben Portals hängen (eine Agentur
-- vermarktet dasselbe Haus über zwei Airbnb-Zugänge). Der alte Index
-- (property_id, ota_portal_code) verbot das; eindeutig ist das Tripel mit Konto.
drop index if exists public.channex_channel_connection_property_portal_uidx;

create unique index if not exists channex_channel_connection_property_portal_uidx
    on public.channex_channel_connection (property_id, ota_portal_code, ota_account_id)
    where property_id is not null;

-- Solange eine Zeile noch kein Konto trägt (Verbindung angefangen, Kanal noch
-- nicht da), bleibt die alte Eindeutigkeit bestehen — sonst legte jeder Klick
-- vor der Autorisierung eine weitere Zeile an.
create unique index if not exists channex_channel_connection_property_portal_null_uidx
    on public.channex_channel_connection (property_id, ota_portal_code)
    where property_id is not null and ota_account_id is null;

comment on table public.ota_account is
    'Ein Zugang eines Betriebs zu einem Portal (Airbnb-Host, Booking-Hotel). '
    'Ein Betrieb kann je Portal mehrere führen — Agenturen betreuen hunderte. '
    'Entspricht genau einem Channex-Kanal (Doku channel-mapping-guides/airbnb).';

-- RLS: wie jede neue public-Tabelle. Konten tragen Zugangs-Metadaten des
-- Betriebs — nur der eigene Mandant, und geschrieben wird ausschließlich
-- serverseitig (Wurzel 6: revoke, nicht nur enable rls).
alter table public.ota_account enable row level security;

drop policy if exists ota_account_tenant on public.ota_account;
create policy ota_account_tenant on public.ota_account
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Restriktiv obendrauf, wie bei `channex_channel_connection`: eine permissive
-- `for all`-Policy allein genügt nicht, weil sie sich mit anderen permissiven
-- Policies ODER-verknüpft. Die restriktive UND-verknüpft und schließt damit den
-- Schreibpfad über PostgREST wirklich (Wurzel 6).
drop policy if exists ota_account_write_restrict on public.ota_account;
create policy ota_account_write_restrict on public.ota_account
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Geschrieben wird NUR serverseitig (service_role). Ein eingeloggter Nutzer mit
-- dem öffentlichen anon-Key spricht PostgREST direkt an — ohne diesen Entzug
-- könnte er sich per `curl` ein fremdes Konto an sein Objekt hängen.
revoke insert, update, delete on public.ota_account from anon, authenticated;
