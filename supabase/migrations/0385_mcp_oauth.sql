-- 0385 — OAuth-2.1-Authorization-Server für den MCP-Connector.
--
-- WOZU: claude.ai (und jeder andere MCP-Client) verbindet sich als OAuth-Client
-- mit unserem MCP-Server. Anthropic unterstützt AUSDRÜCKLICH KEINEN
-- `client_credentials`-Grant („Every connection requires user consent") — der
-- vorhandene Token-Endpunkt aus 0179 (api_clients) ist dafür also unbrauchbar.
-- Gebraucht wird der user-delegierte Authorization-Code-Flow mit PKCE.
--
-- WARUM KEINE CLIENT-TABELLE: Wir setzen auf CIMD (Client ID Metadata Document)
-- statt auf Dynamic Client Registration. Bei DCR registriert Claude bei JEDER
-- frischen Verbindung einen neuen Client — bei vielen Betrieben wüchse eine
-- `oauth_clients`-Tabelle unbegrenzt, ohne dass ein Eintrag je wieder gebraucht
-- würde. Anthropic empfiehlt CIMD für Server mit vielen Nutzern ausdrücklich.
-- Bei CIMD IST die `client_id` eine HTTPS-URL, die auf die Client-Metadaten
-- zeigt; der Server holt sie zur Laufzeit und prüft die `redirect_uri` dagegen.
-- Es gibt daher nichts zu speichern außer Codes und erteilten Zustimmungen.

-- ---------------------------------------------------------------------------
-- 1) Autorisierungscodes — kurzlebig, EINMAL einlösbar.
-- ---------------------------------------------------------------------------
create table if not exists public.mcp_auth_codes (
    -- Der Code selbst wird NICHT im Klartext gespeichert: wer die Tabelle liest,
    -- könnte sonst einen offenen Code gegen ein Token tauschen. Gespeichert ist
    -- sein SHA-256 (wie api_clients.secret_hash, 0179).
    code_hash        text primary key,
    tenant_id        uuid not null references public.tenants(id) on delete cascade,
    user_id          uuid not null references public.users(id) on delete cascade,
    client_id        text not null,          -- CIMD-URL des Clients
    redirect_uri     text not null,          -- exakt geprüft beim Einlösen
    -- PKCE (RFC 7636). Claude schickt IMMER S256 — `plain` wird nicht
    -- unterstützt, ein fehlender Verifier ist ein Fehler, kein Sonderfall.
    code_challenge   text not null,
    scope            text not null default '',
    -- RFC 8707: für welche Ressource der Token gilt. Beim Einlösen muss die
    -- Audience des Tokens genau das tragen, sonst ist Token-Passthrough möglich.
    resource         text not null default '',
    expires_at       timestamptz not null,
    -- Einlösung vermerken statt löschen: ein zweiter Versuch mit demselben Code
    -- ist ein Angriffssignal (abgefangener Code) und gehört erkannt, nicht als
    -- „unbekannt" behandelt. Der Aufräum-Job entfernt die Zeile später.
    used_at          timestamptz,
    created_at       timestamptz not null default now()
);

create index if not exists mcp_auth_codes_expires_idx
    on public.mcp_auth_codes(expires_at);

-- ---------------------------------------------------------------------------
-- 2) Erteilte Zustimmungen — je (Nutzer, Client).
-- ---------------------------------------------------------------------------
-- Pflicht laut MCP-Security-Spec: „Maintain a registry of approved client_id
-- values per user" und diese Prüfung VOR dem Weiterleiten. Ohne sie ist der
-- Confused-Deputy-Angriff möglich, bei dem ein vorhandenes Consent-Cookie den
-- Zustimmungsdialog überspringt und der Code an eine fremde redirect_uri geht.
create table if not exists public.mcp_consents (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    user_id       uuid not null references public.users(id) on delete cascade,
    client_id     text not null,
    scope         text not null default '',
    created_at    timestamptz not null default now(),
    -- Widerruf: der Nutzer kann eine Verbindung im Konto trennen. Zeile bleibt
    -- stehen (Nachweis, wann zugestimmt wurde), gilt aber nicht mehr.
    revoked_at    timestamptz,
    unique (user_id, client_id)
);

create index if not exists mcp_consents_user_idx
    on public.mcp_consents(user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- 3) Refresh-Token — rotierend (OAuth 2.1 für öffentliche Clients).
-- ---------------------------------------------------------------------------
-- CIMD registriert Claude als PUBLIC client (`token_endpoint_auth_method: none`).
-- Für solche Clients verlangt OAuth 2.1 rotierende Refresh-Token: bei jedem
-- Refresh wird der alte ungültig und ein neuer ausgegeben.
create table if not exists public.mcp_refresh_tokens (
    token_hash    text primary key,          -- SHA-256, nie im Klartext
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    user_id       uuid not null references public.users(id) on delete cascade,
    client_id     text not null,
    scope         text not null default '',
    resource      text not null default '',
    expires_at    timestamptz not null,
    -- Nachfolger-Kette: wird ein bereits rotierter Token erneut vorgelegt, ist
    -- er abgefangen worden. Dann gilt die GANZE Kette als kompromittiert und
    -- wird verworfen (OAuth 2.1 Reuse-Detection) — deshalb bleibt die Zeile
    -- nach der Rotation stehen, statt gelöscht zu werden.
    rotated_at    timestamptz,
    created_at    timestamptz not null default now()
);

create index if not exists mcp_refresh_tokens_user_idx
    on public.mcp_refresh_tokens(user_id, client_id);
create index if not exists mcp_refresh_tokens_expires_idx
    on public.mcp_refresh_tokens(expires_at);

-- ---------------------------------------------------------------------------
-- 4) Absicherung (Wurzel 6) — NICHTS davon gehört an den DB-Direktpfad.
-- ---------------------------------------------------------------------------
-- Diese drei Tabellen sind Auth-Infrastruktur: wer sie lesen kann, kann Codes
-- einlösen und Sitzungen übernehmen. `enable rls` + Tenant-Policy reicht dafür
-- NICHT — erst das pauschale GRANT entziehen, dann bleibt nur service_role.
alter table public.mcp_auth_codes enable row level security;
alter table public.mcp_consents enable row level security;
alter table public.mcp_refresh_tokens enable row level security;

revoke select, insert, update, delete on public.mcp_auth_codes
    from anon, authenticated;
revoke select, insert, update, delete on public.mcp_consents
    from anon, authenticated;
revoke select, insert, update, delete on public.mcp_refresh_tokens
    from anon, authenticated;

-- Restriktive Policies als zweite Schicht, `for all` (nicht nur `for select`):
-- sonst wäre der SCHREIB-Pfad tenant-weit offen, falls je ein GRANT zurückkommt.
drop policy if exists mcp_auth_codes_tenant_restrict on public.mcp_auth_codes;
create policy mcp_auth_codes_tenant_restrict on public.mcp_auth_codes
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists mcp_consents_tenant_restrict on public.mcp_consents;
create policy mcp_consents_tenant_restrict on public.mcp_consents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists mcp_refresh_tokens_tenant_restrict on public.mcp_refresh_tokens;
create policy mcp_refresh_tokens_tenant_restrict on public.mcp_refresh_tokens
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

comment on table public.mcp_auth_codes is
    'OAuth-Autorisierungscodes des MCP-Connectors (SHA-256, einmalig, ~60 s). '
    'Kein Direktpfad: nur service_role.';
comment on table public.mcp_consents is
    'Erteilte Zustimmungen je (Nutzer, MCP-Client). Pflicht gegen Confused-Deputy.';
comment on table public.mcp_refresh_tokens is
    'Rotierende Refresh-Token (OAuth 2.1, public client) mit Reuse-Detection.';
