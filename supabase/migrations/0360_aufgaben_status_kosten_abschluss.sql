-- 0360 — Aufgaben: vierter Status, Kosten je Aufgabe, Abschluss-Rückmeldung,
--        abhakbare Checklisten-Punkte
--
-- ANLASS (11.08.2026): Gleichzug mit Hostaway, nachdem der Aufgabenbereich
-- sonst schon Lodgify-Umfang hat. Vier Dinge fehlten:
--   1. `accepted` — der Zustand zwischen „liegt da" und „ich arbeite dran".
--   2. Kosten je Aufgabe (die Reinigungskraft kauft Klopapier).
--   3. Abschluss-Rückmeldung mit Bewertung.
--   4. Checklisten-Punkte abhaken (die Spalte gab es, den Weg dorthin nicht).
--
-- ============================================================================
-- WARUM KOSTEN UND BEWERTUNG NICHT AN `tasks` HÄNGEN (Wurzel 6)
-- ============================================================================
-- `public.tasks` und `public.checklist_items` tragen ein pauschales
-- `select`-GRANT für `authenticated` — nötig, damit die Realtime-Abos der
-- Aufgabenlisten überhaupt Zeilen liefern. Ein eingeloggter Zugang mit dem
-- öffentlichen anon-Key liest diese Tabellen also DIREKT über PostgREST, am
-- FastAPI-Layer vorbei; was dort steht, ist für ihn im Rahmen der RLS sichtbar.
--
-- Zwei neue Spalten an `tasks` wären damit sofort offen:
--   * Kosten sind FINANZDATEN. §4.3 gibt staff/cleaner ausdrücklich keinen
--     Finanz-/Vertriebseinblick. Seine EIGENE Auslage einzutragen ist etwas
--     anderes, als die Auslagen des ganzen Betriebs lesen zu können.
--   * Eine Bewertung ist ein PERSONENDATUM über die zuständige Person. Tenant-
--     weit lesbar hieße: jede Reinigungskraft liest die Benotung aller
--     Kolleginnen und Kollegen.
-- Ein spaltenweises `revoke select (spalte)` hilft hier NICHT, solange das
-- Tabellen-GRANT besteht (CLAUDE.md Wurzel 6), und das Tabellen-GRANT zu
-- entziehen würde die Realtime-Abos der Aufgabenlisten stilllegen.
--
-- Deshalb eigene Tabellen OHNE jedes Grant: sie sind nur über den Service-Key
-- (FastAPI) erreichbar, und dort entscheidet der Dienst, wer was sieht — die
-- zuständige Person ihre eigene Auslage, die Konto-Führung alles.
-- Der vierte Status gehört dagegen an `tasks`: er ist kein sensibles Datum,
-- und die Listen sollen ihn live mitbekommen.

-- =========================================================================
-- 1. Vierter Arbeitszustand: `accepted`
-- =========================================================================
-- Reihenfolge im Enum ist die Reihenfolge der Arbeit: open → accepted →
-- in_progress → done (cancelled steht daneben). `add value ... before` setzt
-- ihn an die richtige Stelle, damit ein `order by status` die Spalten eines
-- Boards in der Reihenfolge liefert, in der man sie liest.
--
-- WAS `accepted` BEDEUTET: Jemand hat die Aufgabe angenommen, aber noch nicht
-- angefangen. Ohne diesen Zustand steht eine Aufgabe entweder unberührt da
-- oder gilt als „in Arbeit", obwohl niemand vor Ort ist — der Betrieb kann
-- nicht unterscheiden, ob sich schon jemand gekümmert hat.
alter type public.task_status add value if not exists 'accepted' before 'in_progress';


-- =========================================================================
-- 2. Kosten je Aufgabe
-- =========================================================================
-- MEHRERE Positionen je Aufgabe, nicht eine Summe: eine Reinigung kann
-- Klopapier UND Fahrtkosten haben, und eine einzige Zahl mit einer Notiz
-- daneben zwingt dazu, sie im Kopf zu addieren und die Herkunft in den Text zu
-- schreiben.
--
-- WÄHRUNG: Pflichtfeld, IMMER aus den Daten (Objektwährung, sonst
-- Betriebswährung). Es gibt hier bewusst KEINEN Default und keinen
-- €-Rückfall — 27 EU-Länder, und ein plausibel aussehender Ersatzwert wäre
-- eine falsche Zahl in einer Abrechnung (Wurzel 4). Fehlt die Währung an
-- Objekt und Betrieb, lehnt der Dienst mit 422 ab.
create table if not exists public.task_costs (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    task_id     uuid not null references public.tasks (id) on delete cascade,
    -- Betrag in der Währung der Zeile. Negativ ist kein gültiger Aufwand;
    -- eine Gutschrift ist ein anderer Vorgang und hat hier nichts verloren.
    amount      numeric(12, 2) not null check (amount >= 0),
    currency    char(3) not null check (currency ~ '^[A-Z]{3}$'),
    note        text,
    -- WER die Auslage erfasst hat. Ohne das ist später nicht mehr zu klären,
    -- wer das Geld ausgelegt hat — genau die Frage bei der Erstattung.
    created_by  uuid references public.users (id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists task_costs_task_idx on public.task_costs (task_id);
create index if not exists task_costs_tenant_idx on public.task_costs (tenant_id, created_at desc);

comment on table public.task_costs is
    'Auslagen zu einer Aufgabe (Hostaway-Gleichzug). BEWUSST eine eigene '
    'Tabelle ohne Grants: an tasks haengend waeren Finanzdaten fuer jeden '
    'authenticated-Zugang per PostgREST lesbar, weil tasks fuer die '
    'Realtime-Abos ein Tabellen-select traegt (Wurzel 6, 0360).';

comment on column public.task_costs.currency is
    'ISO-4217 der Zeile, IMMER aus den Daten (Objekt- bzw. Betriebswaehrung). '
    'Kein Default und kein EUR-Rueckfall — fehlt sie, lehnt der Dienst ab '
    '(Wurzel 4).';


-- =========================================================================
-- 3. Abschluss-Rückmeldung mit Bewertung
-- =========================================================================
-- Genau EINE je Aufgabe (unique): „wie ist es gelaufen" ist eine Aussage über
-- den Vorgang, keine Sammlung. Wer sie ändert, ändert sie — deshalb
-- `updated_at` und kein zweiter Eintrag.
--
-- SKALA 1–5, weil sie ohne Legende lesbar ist und der Betrieb sie aus
-- Bewertungen kennt. Der Wert ist OPTIONAL: eine Rückmeldung ohne Note ist ein
-- gültiger Fall („alles ok, aber der Schlüssel klemmt"), und eine erfundene 3
-- wäre eine Behauptung über eine Leistung (Wurzel 4).
create table if not exists public.task_resolutions (
    task_id     uuid primary key references public.tasks (id) on delete cascade,
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    note        text,
    score       smallint check (score between 1 and 5),
    created_by  uuid references public.users (id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    -- Eine Ruecmeldung ohne Text UND ohne Note ist keine: sie stuende leer in
    -- der Aufgabe und behauptete, es gaebe eine Einschaetzung.
    constraint task_resolutions_nicht_leer
        check (score is not null or (note is not null and length(btrim(note)) > 0))
);

create index if not exists task_resolutions_tenant_idx
    on public.task_resolutions (tenant_id, created_at desc);

comment on table public.task_resolutions is
    'Abschluss-Rueckmeldung je Aufgabe (Text + Note 1-5, Hostaway-Gleichzug). '
    'Eigene Tabelle ohne Grants: eine Bewertung ist ein Personendatum ueber '
    'die zustaendige Person und darf nicht tenant-weit per PostgREST lesbar '
    'sein (Wurzel 6, 0360).';


-- =========================================================================
-- 4. RLS + Grants: beide Tabellen sind fuer den Direktpfad ZU
-- =========================================================================
-- `enable rls` allein reicht nicht (Wurzel 6) — ohne Grants kommt ohnehin
-- niemand heran, aber RLS bleibt als zweite Schicht an, falls jemand spaeter
-- ein Grant setzt. Die Policy erlaubt ausschliesslich service_role.
alter table public.task_costs enable row level security;
alter table public.task_resolutions enable row level security;

revoke all on public.task_costs from anon, authenticated;
revoke all on public.task_resolutions from anon, authenticated;

grant select, insert, update, delete on public.task_costs to service_role;
grant select, insert, update, delete on public.task_resolutions to service_role;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'task_costs'
          and policyname = 'task_costs_nur_service'
    ) then
        create policy task_costs_nur_service on public.task_costs
            as restrictive for all
            using (auth.role() = 'service_role')
            with check (auth.role() = 'service_role');
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'task_resolutions'
          and policyname = 'task_resolutions_nur_service'
    ) then
        create policy task_resolutions_nur_service on public.task_resolutions
            as restrictive for all
            using (auth.role() = 'service_role')
            with check (auth.role() = 'service_role');
    end if;
end
$$;


-- =========================================================================
-- 5. Checklisten-Punkte: WER hat WANN abgehakt
-- =========================================================================
-- `done` gab es schon, aber keinen Weg, es zu setzen — und keine Spur, wer es
-- war. Beim Reinigungsnachweis ist genau das die Frage: hat die Reinigungskraft
-- vor Ort abgehakt oder jemand im Büro nachträglich? Ohne Urheber ist das
-- Häkchen eine Behauptung ohne Absender.
alter table public.checklist_items
    add column if not exists done_at timestamptz,
    add column if not exists done_by uuid references public.users (id) on delete set null;

comment on column public.checklist_items.done_at is
    'Wann der Punkt abgehakt wurde; NULL = offen. Zusammen mit done_by die '
    'Spur hinter dem Haken (0360).';

comment on column public.checklist_items.done_by is
    'Wer den Punkt abgehakt hat. NULL bei Altbestand (vor 0360 gab es keinen '
    'Weg zum Abhaken) oder wenn der Zugang geloescht wurde.';
