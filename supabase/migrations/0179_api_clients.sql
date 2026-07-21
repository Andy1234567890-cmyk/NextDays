-- 0179_api_clients.sql — Entwickler-API-Zugang (Booking.com-„Machine Account"-Modell)
--
-- Der Betrieb (Tenant = „Provider") erzeugt API-Clients, gibt Client-ID +
-- Client-Secret an seinen Entwickler. Der Entwickler tauscht sie am
-- Token-Endpunkt gegen ein kurzlebiges JWT (1 h) und ruft damit die REST-API.
-- Jeder Client ist auf eine TEILMENGE der Objekte + auf RESSOURCEN-SCOPES
-- beschränkt (nicht Vollzugriff), und existiert als Test- ODER Live-Client.
--
-- Belegt (3-Agenten-Recherche gegen developers.booking.com): Machine Account =
-- Client-ID/Secret → kurzlebiges Bearer-JWT; multi-property; Rechte hängen am
-- Connection-Type (funktionsgebundene Scopes, kein pauschaler Vollzugriff).
--
-- SICHERHEIT (Wurzel 6): Das Secret ist ein Geheimnis. NUR der Hash liegt in der
-- DB, und die ganze Tabelle wird gegen anon/authenticated gesperrt — ein
-- eingeloggter Client mit anon-Key darf per curl /rest/v1/api_clients WEDER den
-- Hash lesen NOCH Zeilen schreiben. Geschrieben/gelesen wird ausschließlich
-- serverseitig über service_role (der FastAPI-Layer).

create table if not exists public.api_clients (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    -- Öffentliche, unratbare Client-ID: Prefix trägt Marke + Umgebung
    -- (mnd_live_… / mnd_test_…). Eindeutig → schneller Lookup beim Token-Tausch.
    client_id      text not null unique,
    -- NUR der SHA-256-Hash des Secrets. Klartext wird genau EINMAL bei der
    -- Erzeugung angezeigt und nie gespeichert (Stripe-„show once").
    secret_hash    text not null,
    -- Letzte 4 Zeichen des Secrets im Klartext — nur zur Wiedererkennung in der
    -- UI (unkritisch, nicht zum Auth nutzbar).
    secret_last4   text not null,
    -- Anzeigename (z. B. „Meine Integration", „Agentur XY").
    name           text not null,
    -- Test- vs. Live-Client: strikt getrennte Datenräume (is_test propagiert in
    -- den Token-Claim und wird serverseitig durchgesetzt).
    is_test        boolean not null default false,
    -- Ressourcen-Scopes (funktionsgebunden, Booking-„Connection Type"-Modell):
    -- z. B. {'reservations:read','rates:write','availability:read'}. Leer = kein
    -- Zugriff (fail-closed). Der Token erhält genau diese Scopes.
    scopes         text[] not null default '{}',
    -- Objekt-Beschränkung: auf welche properties dieser Client zugreifen darf.
    -- Leeres Array = ALLE Objekte des Tenants (wie Booking „add properties to a
    -- machine account"); sonst nur die gelisteten.
    property_ids   uuid[] not null default '{}',
    -- Sofort-Revoke: gesetzt = Client kann keine Tokens mehr tauschen. Alte,
    -- bereits ausgegebene Tokens laufen binnen 1 h ab (kurze Gültigkeit).
    revoked_at     timestamptz,
    last_used_at   timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index api_clients_tenant_idx on public.api_clients (tenant_id);
-- Lookup beim Token-Tausch: nur nicht-widerrufene Clients.
create index api_clients_active_idx on public.api_clients (client_id)
    where revoked_at is null;

create trigger trg_api_clients_updated
    before update on public.api_clients
    for each row execute function public.set_updated_at();

-- =========================================================================
-- Wurzel 6 — RLS + harter GRANT-Entzug (sensible Secret-Tabelle)
-- =========================================================================
-- enable rls + tenant-Policy ALLEIN reicht für Secrets NICHT. Zusätzlich das
-- pauschale Tabellen-GRANT vollständig entziehen: kein anon/authenticated darf
-- die Tabelle lesen ODER schreiben. Nur service_role (der Server) verwaltet sie.
alter table public.api_clients enable row level security;

-- Restriktive Tenant-Policy als Backstop (falls doch ein GRANT bestünde):
-- greift für ALLE Operationen, nicht nur select (sonst wäre der Schreibpfad
-- tenant-weit offen).
create policy api_clients_tenant_isolation on public.api_clients
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Harter Entzug: weder lesen noch schreiben für anon/authenticated. Der
-- Secret-Hash und die Scopes verlassen die DB nur über den Server.
revoke select, insert, update, delete on public.api_clients from anon;
revoke select, insert, update, delete on public.api_clients from authenticated;

comment on table public.api_clients is
  'Entwickler-API-Clients (Booking-„Machine Account"-Modell): Client-ID + '
  'gehashtes Secret pro Tenant, mit Ressourcen-Scopes + Objekt-Beschränkung, '
  'Test/Live getrennt. Nur service_role liest/schreibt (Secret ist geheim).';
comment on column public.api_clients.secret_hash is
  'SHA-256 des Client-Secrets. Klartext nie gespeichert (show-once bei Erzeugung).';
comment on column public.api_clients.scopes is
  'Funktionsgebundene Ressourcen-Scopes (z. B. reservations:read, rates:write). '
  'Leer = kein Zugriff (fail-closed).';
comment on column public.api_clients.property_ids is
  'Objekt-Beschränkung; leeres Array = alle Objekte des Tenants.';
