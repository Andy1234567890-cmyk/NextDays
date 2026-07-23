-- Geräteverlauf / Login-Aktivität (Airbnb „Login & Sicherheit → Geräteverlauf").
--
-- Warum eine EIGENE Tabelle statt auth.sessions (GoTrue)?
--   auth.sessions.ip trägt bei server-zu-server-Login (BFF → FastAPI → GoTrue)
--   immer die SERVER-IP, nie die echte Browser-IP (GoTrue liest die TCP-RemoteAddr;
--   live verifiziert: X-Forwarded-For / Sb-Forwarded-For werden ohne Flag ignoriert).
--   Außerdem entstehen pro Login MEHRERE Zeilen (Passwort-Schritt + 2FA-verify_otp).
--   Darum erfasst UNSER Backend beim erfolgreichen Login genau EINE Zeile mit der
--   selbst (aus X-Forwarded-For, trusted hops) ermittelten echten Client-IP.
--
-- Sensibel (PII: IP, User-Agent, Ort) → Wurzel 6: RLS + harter GRANT-Entzug.
-- Nur service_role (der Server) schreibt/liest; anon/authenticated kommen per
-- anon-Key-curl NICHT an fremde Geräte/IPs.

create table if not exists public.login_devices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    -- GoTrue-Session dieses Logins. Koppelt den Widerruf: „Gerät abmelden"
    -- löscht die auth.sessions-Zeile mit dieser id (kaskadiert auf refresh_tokens).
    -- NULL nur, falls die Session-ID beim Login (noch) nicht ermittelbar war.
    session_id uuid,
    -- Echte Client-IP (Browser), serverseitig aus X-Forwarded-For (trusted hops)
    -- ermittelt. inet, damit Range-Suche gegen ip_geo_ranges sauber typisiert ist.
    ip inet,
    -- Roher User-Agent-String des Browsers (Parsing zu „Chrome · macOS" im UI).
    user_agent text,
    -- Aufgelöster Ort aus der eigenen ip_geo_ranges-Tabelle (kein Fremddienst).
    -- NULL = kein passender Bereich hinterlegt → UI zeigt „—", kein Fake (Wurzel 4).
    country text,
    city text,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

create index if not exists login_devices_user_idx
    on public.login_devices (user_id, created_at desc);
create index if not exists login_devices_session_idx
    on public.login_devices (session_id);

comment on table public.login_devices is
    'Login-Aktivität pro Gerät (echte Browser-IP + User-Agent + Ort), von der App '
    'geschrieben — NICHT aus auth.sessions (dort steht die Server-IP). Widerruf '
    'koppelt über session_id an die GoTrue-Session.';

-- --- Eigene IP→Ort-Tabelle (kein MaxMind/DB-IP/Fremddienst) -----------------
-- Wir pflegen die Bereiche selbst. Der Resolver sucht die IP zwischen ip_from und
-- ip_to (inklusiv). Leere Tabelle / kein Treffer → Ort bleibt NULL (kein Fake).
create table if not exists public.ip_geo_ranges (
    id uuid primary key default gen_random_uuid(),
    ip_from inet not null,
    ip_to inet not null,
    country text not null,
    city text,
    created_at timestamptz not null default now(),
    -- ip_from darf nicht größer als ip_to sein (sonst matcht der Bereich nie).
    constraint ip_geo_ranges_order check (ip_from <= ip_to)
);

-- Range-Suche „ip zwischen ip_from und ip_to": B-Tree auf ip_from. Der Resolver
-- nimmt den größten ip_from <= client_ip und prüft ip_to >= client_ip → mit
-- diesem Index findet Postgres den Kandidaten ohne Full-Scan.
create index if not exists ip_geo_ranges_from_idx
    on public.ip_geo_ranges (ip_from);

comment on table public.ip_geo_ranges is
    'Selbst gepflegte IP→Ort-Zuordnung (kein Fremddienst). Der Resolver nimmt den '
    'Bereich, in dem die Client-IP liegt. Kein Treffer → Ort unbekannt (Wurzel 4).';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
alter table public.login_devices enable row level security;
alter table public.ip_geo_ranges enable row level security;

-- Kein pauschales Grant an anon/authenticated — nur der Server (service_role)
-- greift zu. Falls Default-Privilegien etwas gesetzt haben: entziehen.
revoke all on public.login_devices from anon, authenticated;
revoke all on public.ip_geo_ranges from anon, authenticated;

-- Restriktive Guard für ALLE Operationen: login_devices ist streng per-User —
-- selbst wenn je ein Grant hinzukäme, sähe/änderte ein Client nur EIGENE Zeilen.
create policy login_devices_self_restrict on public.login_devices
    as restrictive for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- ip_geo_ranges ist Referenzdaten (keine Nutzerdaten): kein Client darf lesen/
-- schreiben — restriktiv alles verbieten, nur service_role (das RLS umgeht) nutzt sie.
create policy ip_geo_ranges_no_client on public.ip_geo_ranges
    as restrictive for all
    using (false)
    with check (false);
