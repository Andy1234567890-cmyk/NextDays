-- 0493 — KI-Autoantwort: Regeln, Zustellart und Protokoll
--
-- WARUM: Bis hierher konnte die KI einen Vorschlag ERZEUGEN (0492 + der
-- Kontextsammler). Was sie senden DARF, war nirgends hinterlegt — es gab ein
-- einziges Freitextfeld `inbox_ai_settings.extra_prompt` für den ganzen
-- Betrieb. Damit ließ sich nicht ausdrücken, was jeder Betrieb braucht:
-- „WLAN-Fragen darf sie allein beantworten, Erstattungen nie".
--
-- Diese Migration legt die Steuerung an. Drei Tabellen:
--
--   ki_regel            Was die KI zu einem Thema tun soll und WIE es
--                       zugestellt wird (Entwurf oder automatisch).
--   ki_regel_objekt     Für welche Objekte eine Regel gilt (n:m).
--   ki_antwort_protokoll  Was tatsächlich passiert ist.
--
-- Das Protokoll ist NICHT optional. Eine KI, die selbständig an Gäste
-- schreibt, ohne dass jemand danach nachvollziehen kann, WAS sie geschickt
-- hat, WELCHE Regel griff und WORAUF die Antwort fußte, ist nicht
-- diagnostizierbar. Fällt eine Antwort falsch aus, bliebe nur das Raten
-- zwischen „Fakt fehlte", „Regel griff nicht" und „Modell hat sich etwas
-- zurechtgelegt". Deshalb entsteht die Zeile bei JEDER Antwort, auch beim
-- Entwurf.
--
-- SICHERHEIT (Wurzel 6): Alle drei Tabellen bekommen RLS, eine
-- Tenant-Policy UND eine RESTRIKTIVE Policy `for all` — nicht nur
-- `for select`, sonst wäre der Schreibpfad tenant-weit offen. Zusätzlich
-- wird anon/authenticated jedes Recht entzogen: diese Tabellen steuern, was
-- automatisch an Gäste hinausgeht, und das Protokoll enthält Auszüge echter
-- Gastnachrichten. Beides gehört ausschließlich dem Server (service_role).
-- Ein eingeloggter cleaner mit dem anon-Key bekommt hier per
-- `curl /rest/v1/ki_regel` weder etwas zu lesen noch etwas zu schreiben.

-- --------------------------------------------------------------------------
-- Regeln
-- --------------------------------------------------------------------------
create table if not exists public.ki_regel (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    name text not null,
    aktiv boolean not null default true,

    -- 'alle'    = jedes Objekt des Betriebs
    -- 'auswahl' = die in ki_regel_objekt genannten
    gilt_fuer text not null default 'alle'
        check (gilt_fuer in ('alle', 'auswahl')),

    -- Der Kern der Steuerung. 'entwurf' ist die VORGABE: automatisch wird
    -- bewusst eingeschaltet, nie versehentlich geerbt.
    zustellart text not null default 'entwurf'
        check (zustellart in ('entwurf', 'automatisch')),

    -- Die Anweisung an das Modell, in Worten des Betriebs. Platzhalter der
    -- Vorlagen ({{guest_name}} …) sind erlaubt.
    anweisung text not null,

    -- Eine Eskalationsregel ANTWORTET NICHT, sondern meldet. Deshalb ein
    -- eigenes Flag und kein dritter `zustellart`-Wert: „wie wird zugestellt"
    -- und „wird überhaupt geantwortet" sind zwei Fragen, und als ein Feld
    -- verschmolzen ließe sich „melden UND als Entwurf hinterlegen" nicht mehr
    -- ausdrücken.
    ist_eskalation boolean not null default false,
    benachrichtigen boolean not null default false,

    -- Die „Used"-Spalte der Übersicht. Ohne sie sieht der Betrieb nicht,
    -- welche seiner Regeln tote Buchstaben sind.
    verwendet_zaehler integer not null default 0
        check (verwendet_zaehler >= 0),
    zuletzt_verwendet_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint ki_regel_name_nicht_leer check (length(btrim(name)) > 0),
    constraint ki_regel_anweisung_nicht_leer check (length(btrim(anweisung)) > 0),
    -- Wurzel 8: jeder unbegrenzte Bereich bekommt eine Obergrenze. Die
    -- Anweisung geht in den Prompt; ohne Deckel könnte eine einzige Regel den
    -- Kontext verdrängen, den der Sammler mühsam ausgewählt hat.
    constraint ki_regel_anweisung_laenge check (length(anweisung) <= 2000),
    constraint ki_regel_name_laenge check (length(name) <= 200)
);

create index if not exists ki_regel_tenant_idx
    on public.ki_regel (tenant_id, aktiv);

-- --------------------------------------------------------------------------
-- Zuordnung Regel → Objekt
-- --------------------------------------------------------------------------
create table if not exists public.ki_regel_objekt (
    regel_id uuid not null references public.ki_regel (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    -- Redundant zur Regel, aber notwendig: die RLS-Policy dieser Tabelle muss
    -- ohne Join auf ki_regel entscheiden koennen.
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    primary key (regel_id, property_id)
);

create index if not exists ki_regel_objekt_property_idx
    on public.ki_regel_objekt (property_id);

-- --------------------------------------------------------------------------
-- Protokoll
-- --------------------------------------------------------------------------
create table if not exists public.ki_antwort_protokoll (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    -- Der Thread ist je nach Quelle eine channex_booking- oder eine
    -- whatsapp_conversation-Zeile. Deshalb KEIN Fremdschlüssel, sondern die
    -- Quelle daneben — ein FK auf eine von zwei Tabellen ginge nicht, und ein
    -- geratener FK bräche den jeweils anderen Pfad.
    thread_id text not null,
    quelle text not null check (quelle in ('inbox', 'whatsapp')),

    regel_id uuid references public.ki_regel (id) on delete set null,

    -- Auszug, nicht die ganze Nachricht: das Protokoll ist eine Spur, kein
    -- zweites Postfach. Die vollständige Nachricht steht dort, wo sie hingehört.
    frage_auszug text,
    antwort text,
    zustellart text not null check (zustellart in ('entwurf', 'automatisch')),
    gesendet_at timestamptz,

    -- Welche Quellen die Antwort trugen und was fehlte — die eigentliche
    -- Diagnose. Als jsonb, weil die Liste je nach Objekt anders aussieht.
    quellen jsonb not null default '[]'::jsonb,
    weggelassen jsonb not null default '[]'::jsonb,

    eskaliert boolean not null default false,
    grund text,

    modell text,
    region text,
    tokens_ein integer not null default 0 check (tokens_ein >= 0),
    tokens_aus integer not null default 0 check (tokens_aus >= 0),

    created_at timestamptz not null default now(),

    constraint ki_protokoll_frage_laenge
        check (frage_auszug is null or length(frage_auszug) <= 2000),
    constraint ki_protokoll_grund_laenge
        check (grund is null or length(grund) <= 500)
);

create index if not exists ki_antwort_protokoll_tenant_idx
    on public.ki_antwort_protokoll (tenant_id, created_at desc);

create index if not exists ki_antwort_protokoll_thread_idx
    on public.ki_antwort_protokoll (tenant_id, thread_id, created_at desc);

-- --------------------------------------------------------------------------
-- Der grosse Schalter + Verzoegerung (inbox_ai_settings)
-- --------------------------------------------------------------------------
-- `auto_suggest` gibt es bereits: es steuert, ob die OBERFLÄCHE einen
-- Vorschlag anbietet. Das ist etwas anderes als „die KI antwortet selbst" —
-- die beiden zu vermengen hiesse, dass ein Betrieb mit eingeschaltetem
-- Vorschlag ungefragt automatisch antwortet.
alter table public.inbox_ai_settings
    add column if not exists autoantwort_aktiv boolean not null default false;

-- Wie lange gewartet wird, bevor eine automatische Antwort hinausgeht.
-- Der Sinn ist NICHT Rechenzeit, sondern der Mensch: in diesem Fenster kann
-- ein Mitarbeiter selbst antworten, und dann wird die KI-Antwort verworfen.
-- 0 heisst sofort.
alter table public.inbox_ai_settings
    add column if not exists autoantwort_verzoegerung_minuten integer not null default 5;

alter table public.inbox_ai_settings
    drop constraint if exists inbox_ai_settings_verzoegerung_bereich;
alter table public.inbox_ai_settings
    add constraint inbox_ai_settings_verzoegerung_bereich
    check (autoantwort_verzoegerung_minuten between 0 and 1440);

-- --------------------------------------------------------------------------
-- RLS + Rechte (Wurzel 6)
-- --------------------------------------------------------------------------
alter table public.ki_regel enable row level security;
alter table public.ki_regel_objekt enable row level security;
alter table public.ki_antwort_protokoll enable row level security;

drop policy if exists ki_regel_tenant on public.ki_regel;
create policy ki_regel_tenant on public.ki_regel
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists ki_regel_write_restrict on public.ki_regel;
create policy ki_regel_write_restrict on public.ki_regel
    as restrictive for all using (tenant_id = public.current_tenant_id());

drop policy if exists ki_regel_objekt_tenant on public.ki_regel_objekt;
create policy ki_regel_objekt_tenant on public.ki_regel_objekt
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists ki_regel_objekt_write_restrict on public.ki_regel_objekt;
create policy ki_regel_objekt_write_restrict on public.ki_regel_objekt
    as restrictive for all using (tenant_id = public.current_tenant_id());

drop policy if exists ki_antwort_protokoll_tenant on public.ki_antwort_protokoll;
create policy ki_antwort_protokoll_tenant on public.ki_antwort_protokoll
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists ki_antwort_protokoll_write_restrict on public.ki_antwort_protokoll;
create policy ki_antwort_protokoll_write_restrict on public.ki_antwort_protokoll
    as restrictive for all using (tenant_id = public.current_tenant_id());

-- RLS allein reicht NICHT: sie erzwingt den Mandanten, nicht die Rolle.
-- Diese drei Tabellen entscheiden, was ohne menschliche Prüfung an Gäste
-- hinausgeht, und das Protokoll enthält Auszüge echter Gastnachrichten.
-- Beides geht ausschliesslich den Server an.
revoke all on public.ki_regel from anon, authenticated;
revoke all on public.ki_regel_objekt from anon, authenticated;
revoke all on public.ki_antwort_protokoll from anon, authenticated;
