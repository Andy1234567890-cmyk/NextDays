-- Technische Diagnose für den Support (einwilligungsbasiert).
--
-- ZWECK: Wenn ein Kunde meldet „es funktioniert nicht", soll der Support den
-- technischen Kontext sehen — Fehler, fehlgeschlagene API-Aufrufe, Browser,
-- App-Version. NICHT: was der Kunde den ganzen Tag getan hat.
--
-- DATENSCHUTZ-ENTSCHEIDUNGEN, bewusst und begründet:
--
-- 1. KEIN Verhaltens-Tracking. Aufgezeichnet werden ausschließlich technische
--    Ereignisse (Fehler, fehlgeschlagene Requests). Eine lückenlose
--    Aktivitätsaufzeichnung wäre bei Betriebsnutzern eine Verhaltenskontrolle
--    (mitbestimmungspflichtig, § 87 BetrVG) und verstieße gegen die
--    Datenminimierung (DSGVO Art. 5 Abs. 1 lit. c).
--
-- 2. EINSICHT NUR MIT FREIGABE. Der Support sieht die Diagnosedaten eines
--    Kontos erst, wenn der Kunde selbst eine Debug-Sitzung startet. Die
--    Freigabe ist zeitlich begrenzt, für den Kunden sichtbar und jederzeit
--    widerrufbar — das ist der Unterschied zwischen Support-Werkzeug und
--    Überwachung.
--
-- 3. KEINE INHALTE. Es werden keine Eingaben, Bildschirminhalte oder
--    Gastdaten gespeichert. URLs werden ohne Query-String abgelegt (dort
--    stehen Suchbegriffe und IDs).
--
-- 4. AUFBEWAHRUNG BEGRENZT. Diagnoseereignisse sind nach 30 Tagen zu löschen
--    (Job, siehe unten) — Fehlerdiagnose braucht keine Historie.

-- --- Debug-Sitzungen (die Einwilligung) -------------------------------------

create table if not exists public.support_debug_sessions (
    id uuid primary key default gen_random_uuid(),

    -- Wer die Diagnose freigegeben hat. Genau EINE Welt (wie support_tickets).
    user_id uuid references auth.users (id) on delete cascade,
    guest_id uuid references public.portal_guests (id) on delete cascade,
    tenant_id uuid references public.tenants (id) on delete cascade,

    -- Optionaler Bezug zum Support-Fall.
    ticket_id uuid references public.support_tickets (id) on delete set null,

    -- Zeitfenster der Freigabe. Nach Ablauf sieht der Support nichts mehr;
    -- ended_at wird beim vorzeitigen Widerruf gesetzt.
    started_at timestamptz not null default now(),
    expires_at timestamptz not null,
    ended_at timestamptz,

    -- Vom Kunden angegebener Grund (erscheint in seiner eigenen Übersicht).
    note text,

    constraint support_debug_genau_ein_melder check (
        (user_id is not null and guest_id is null)
        or (user_id is null and guest_id is not null)
    )
);

create index if not exists support_debug_sessions_aktiv_idx
    on public.support_debug_sessions (expires_at)
    where ended_at is null;
create index if not exists support_debug_sessions_user_idx
    on public.support_debug_sessions (user_id);

comment on table public.support_debug_sessions is
    'Zeitlich begrenzte Freigabe des Kunden, damit der Support seine '
    'technischen Diagnosedaten einsehen darf. Ohne aktive Sitzung sieht das '
    'Backoffice die Ereignisse dieses Kontos NICHT.';

-- --- Diagnose-Ereignisse ----------------------------------------------------

create table if not exists public.support_diagnostics (
    id uuid primary key default gen_random_uuid(),

    -- Wer/welcher Kontext. Beide dürfen null sein (Fehler vor dem Login).
    user_id uuid references auth.users (id) on delete cascade,
    guest_id uuid references public.portal_guests (id) on delete cascade,
    tenant_id uuid references public.tenants (id) on delete cascade,

    -- Welche Oberfläche: 'gastgeber' | 'plattform' | 'web' | 'api' | 'mobile'.
    app text not null,

    -- Art des Ereignisses. Bewusst eng: nur Technisches, keine Aktionen.
    --   error          — unbehandelter Fehler im Frontend
    --   api_error      — fehlgeschlagener Backend-Aufruf (4xx/5xx)
    --   slow_request   — ungewöhnlich langsamer Aufruf
    --   client_info    — Umgebung (Browser/Version), beim Sitzungsstart
    kind text not null
        check (kind in ('error', 'api_error', 'slow_request', 'client_info')),

    -- Kurzbeschreibung (Fehlermeldung, Endpunkt). Keine Inhalte, keine PII.
    message text not null,
    -- Pfad OHNE Query-String (dort stünden Suchbegriffe/IDs).
    path text,
    http_status integer,
    duration_ms integer,

    -- Technischer Kontext: Browser, Bildschirmgröße, App-Version, Stacktrace.
    -- Bewusst jsonb, weil je Ereignisart unterschiedlich.
    context jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);

create index if not exists support_diagnostics_user_zeit_idx
    on public.support_diagnostics (user_id, created_at desc);
create index if not exists support_diagnostics_tenant_zeit_idx
    on public.support_diagnostics (tenant_id, created_at desc);
create index if not exists support_diagnostics_zeit_idx
    on public.support_diagnostics (created_at);

comment on table public.support_diagnostics is
    'Technische Diagnose-Ereignisse (Fehler, fehlgeschlagene Aufrufe). KEINE '
    'Nutzeraktivität, keine Eingaben, keine Bildschirminhalte. Nach 30 Tagen '
    'zu löschen. Für den Support nur bei aktiver Debug-Sitzung sichtbar.';

-- --- Härtung (Wurzel 6) -----------------------------------------------------
alter table public.support_debug_sessions enable row level security;
alter table public.support_diagnostics enable row level security;

revoke all on public.support_debug_sessions from anon, authenticated;
revoke all on public.support_diagnostics from anon, authenticated;

-- Der Kunde darf seine EIGENEN Debug-Sitzungen sehen (Transparenz: er muss
-- erkennen können, dass und wie lange eine Freigabe läuft). Geschrieben wird
-- serverseitig.
grant select on public.support_debug_sessions to authenticated;

create policy support_debug_sessions_self_read on public.support_debug_sessions
    as permissive for select
    using (user_id = auth.uid() or guest_id = auth.uid());

-- Diagnose-Ereignisse: KEIN Client-Lesezugriff. Weder der Kunde noch der
-- Support liest hier direkt — beides läuft über den Server, der die aktive
-- Freigabe prüft und den Zugriff protokolliert.
create policy support_diagnostics_deny_all on public.support_diagnostics
    as restrictive for all using (false) with check (false);
