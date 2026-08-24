-- 0436 — Formular-Abschnitt und Einsendungen
--
-- Etappe F aus docs/WEBSITE-BAUKASTEN-PLAN.md. Unser `contact`-Abschnitt zeigt
-- Kontaktdaten; ein echtes Formular, in das ein Gast etwas eintippt, gab es
-- nicht. Damit fehlte der wichtigste Weg für alles, was keine Buchung ist:
-- Gruppenanfragen, Firmenkunden, Eigentümer, die einen Verwalter suchen.
--
-- Zwei Teile:
--   1. Der Blocktyp `form` — die Felder stehen im `content` wie bei jedem
--      anderen Abschnitt.
--   2. `site_form_submissions` — die Einsendungen.
--
-- === DAS HIER IST DIE SENSIBELSTE TABELLE DES SLICE ========================
--
-- Sie enthält personenbezogene Daten, die ein DRITTER eingetippt hat: Name,
-- E-Mail, Telefon, Freitext. Der Betrieb ist dafür Verantwortlicher im Sinne der
-- DSGVO, wir sind Auftragsverarbeiter. Daraus folgt jede Entscheidung unten:
--
-- Wurzel 6 — der Direktpfad MUSS zu sein, und zwar auch für `select`:
--   Ein eingeloggter `cleaner` mit dem öffentlichen anon-Key kann
--   `curl /rest/v1/site_form_submissions` machen. Der FastAPI-Layer wird dabei
--   komplett umgangen. Eine tenant-Policy allein würde ihm ALLE Einsendungen
--   seines Betriebs zeigen — Namen, Telefonnummern, Anliegen von Gästen. Ein
--   Reinigungskraft-Konto hat damit nichts zu tun.
--   Deshalb: `revoke select, insert, update, delete` für anon UND authenticated.
--   Gelesen wird ausschließlich über die API, die `MANAGE_SITE_CONFIG` prüft.
--
-- Folge davon, bewusst in Kauf genommen: KEIN Realtime-Abo auf dieser Tabelle.
-- Die Antwortenliste im Dashboard lädt beim Öffnen. Ein Abo bräuchte
-- `grant select` für `authenticated` — und damit wäre der Direktpfad offen.
-- Dasselbe Muster wie bei den Finanz-Tabellen (payments, owner_statements).

alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;

alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features', 'form'
    ));

create table if not exists public.site_form_submissions (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null
                references public.tenants (id) on delete cascade,
    -- Welcher Abschnitt es war. `on delete set null`, NICHT cascade: löscht der
    -- Betrieb sein Formular, sollen die Einsendungen BLEIBEN. Sie sind
    -- Geschäftskorrespondenz, keine Beilage zum Block — und ein Gast, der eine
    -- Anfrage geschickt hat, erwartet eine Antwort, auch wenn der Abschnitt
    -- inzwischen anders heißt (Wurzel 1: der Gegenzustand wird gepflegt, aber
    -- er heißt nicht „mitlöschen").
    block_id    uuid references public.site_blocks (id) on delete set null,
    -- Der Name, den der Betrieb dem Formular gegeben hat. Denormalisiert
    -- mitgeführt, damit die Liste nach dem Löschen des Blocks noch sagen kann,
    -- WOHER die Einsendung kam.
    form_name   text,
    -- Die Antworten als {feldname: wert}. Als jsonb, weil die Felder der Betrieb
    -- selbst festlegt — eine Spalte je Feld wäre eine Migration pro Kundenwunsch.
    daten       jsonb not null default '{}'::jsonb,
    -- Wann sie ANKAM. Das ist unsere Uhr und beschreibt unsere Verarbeitung —
    -- hier ist das korrekt, denn das Absenden IST das Ereignis (Wurzel 5b gilt
    -- für FREMDE Ereignisse, nicht für die eigene Entgegennahme).
    created_at  timestamptz not null default now(),
    -- Gelesen-Markierung für den Posteingang der Liste.
    is_read     boolean not null default false,
    constraint site_form_submissions_daten_groesse check (
        pg_column_size(daten) < 64 * 1024
    )
);

-- Der Lesepfad des Dashboards: „die Einsendungen dieses Betriebs, neueste
-- zuerst".
create index if not exists site_form_submissions_tenant_zeit_idx
    on public.site_form_submissions (tenant_id, created_at desc);

comment on table public.site_form_submissions is
    'Einsendungen der Formular-Abschnitte einer Kunden-Website. ENTHÄLT '
    'PERSONENBEZOGENE DATEN DRITTER — kein Grant für anon/authenticated, kein '
    'Realtime-Abo, Zugriff ausschließlich über die API mit MANAGE_SITE_CONFIG.';

alter table public.site_form_submissions enable row level security;

-- Die tenant-Policy ist der zweite Riegel, nicht der erste: der erste ist das
-- fehlende GRANT darunter. Sie steht hier, damit auch ein später versehentlich
-- nachgezogenes Grant nicht tenant-übergreifend liest.
drop policy if exists site_form_submissions_tenant on public.site_form_submissions;
create policy site_form_submissions_tenant on public.site_form_submissions
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Der eigentliche Schutz: NICHTS für anon/authenticated. Auch kein `select`.
revoke select, insert, update, delete
    on public.site_form_submissions from anon, authenticated;

-- Und restriktiv gegengesichert, damit ein nachgezogenes Grant nichts öffnet.
-- Hier `for all` mit `using (false)` — anders als bei `site_redirects` (0430),
-- wo `select` offen bleiben MUSSTE: diese Tabelle darf über den Direktpfad
-- weder gelesen noch geschrieben werden.
drop policy if exists site_form_submissions_kein_direktpfad
    on public.site_form_submissions;
create policy site_form_submissions_kein_direktpfad
    on public.site_form_submissions
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);

comment on policy site_form_submissions_kein_direktpfad
    on public.site_form_submissions is
    'Kein Zugriff über PostgREST/Realtime — auch nicht lesend. Diese Zeilen '
    'enthalten personenbezogene Daten Dritter; sie gehen ausschließlich über '
    'die API an Rollen mit MANAGE_SITE_CONFIG.';

-- BEWUSST KEINE Aufnahme in die Publikation `supabase_realtime`. Ein Abo würde
-- `grant select` für `authenticated` verlangen, und damit wäre der Direktpfad
-- offen. Die Antwortenliste lädt beim Öffnen — das ist der Preis, und er ist
-- richtig gewählt.
