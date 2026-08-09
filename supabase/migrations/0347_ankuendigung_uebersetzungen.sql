-- 0347 — Ankündigungen in allen 24 EU-Amtssprachen.
--
-- WOFÜR: `announcements` (0337) trägt GENAU EINEN Text — den, den das
-- Plattform-Team verfasst hat (auf Deutsch). Kunden sitzen in Schweden,
-- Dänemark und dem übrigen Europa; deren Dashboard läuft bereits vollständig
-- in ihrer Sprache (`web/messages/<locale>.json`, 24 Dateien). Nur die
-- Ankündigung selbst blieb deutsch — ausgerechnet der Text, der Preisänderungen
-- und Wartungsfenster ankündigt.
--
-- WARUM EINE EIGENE TABELLE statt jsonb-Spalten auf `announcements`:
-- Eine Fassung ist kein Wert, sondern ein Datensatz mit eigenem Lebenszyklus —
-- sie wurde zu einem Zeitpunkt erzeugt, von einer Quelle, und ist geprüft oder
-- nicht. Drei jsonb-Spalten (`titel_i18n`, `kurztext_i18n`, `inhalt_i18n`)
-- könnten den Zustand „diese eine Sprache hat ein Mensch korrigiert" nur als
-- vierte Parallel-Map führen; bei jedem Schreiben müssten alle vier konsistent
-- bleiben, und zwei gleichzeitige Korrekturen an verschiedenen Sprachen wären
-- ein Lost-Update auf demselben jsonb-Wert. Eine Zeile je (Ankündigung,
-- Sprache) macht die Korrektur einer Sprache zu einem UPDATE genau einer Zeile.
--
-- WARUM `geprueft` DAS ZENTRALE FELD IST: Der Text enthält rechtliche Aussagen
-- und Geldbeträge. Eine maschinelle Übersetzung ist ein Vorschlag, keine
-- Zusage. Sobald ein Mensch eine Fassung korrigiert hat, ist sie die Wahrheit
-- für diese Sprache — ein späterer Übersetzungslauf (weil der deutsche Text
-- nachgebessert wurde) darf sie NICHT überschreiben. Der Schutz steht deshalb
-- nicht nur im Service, sondern in der WHERE-Klausel jedes maschinellen
-- Schreibens: `where geprueft = false`. Eine geprüfte Zeile ist für den
-- Automaten unerreichbar.

create table if not exists public.announcement_translations (
    id uuid primary key default gen_random_uuid(),

    announcement_id uuid not null
        references public.announcements (id) on delete cascade,

    -- ISO-639-1 der 24 EU-Amtssprachen, deckungsgleich mit
    -- `web/i18n/locales.ts` LOCALES und `apps/api/src/core/sprachen.py`.
    -- CHECK statt FK auf eine Sprachtabelle: die Liste ändert sich nur, wenn
    -- die EU eine Amtssprache aufnimmt — das ist eine bewusste Migration wert
    -- und keine pflegbare Stammdatentabelle.
    sprache text not null check (sprache in (
        'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
        'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
    )),

    -- Die drei übersetzbaren Felder, spiegelbildlich zu `announcements`.
    -- `titel` NOT NULL: eine Fassung ohne Titel ist keine Fassung — der Leser
    -- bekäme eine leere Überschrift. `kurztext` darf NULL sein, weil er auch im
    -- Original optional ist.
    titel text not null,
    kurztext text,
    -- Bereits mit derselben nh3-Allowlist gesäubert wie `announcements.
    -- inhalt_html` — und zwar NACH der Rückkehr vom Übersetzungsdienst: was
    -- ein fremder Dienst zurückgibt, ist Fremd-Input (Wurzel 8), auch wenn wir
    -- ihn selbst gefragt haben.
    inhalt_html text not null default '',

    -- DER SCHUTZ. false = maschinell erzeugt, darf jederzeit neu übersetzt
    -- werden. true = ein Mensch hat sie im Backoffice bearbeitet und
    -- verantwortet sie; kein automatischer Lauf fasst sie mehr an.
    -- Bewusst NICHT als Herkunfts-Enum ('maschinell'|'mensch'|'importiert'):
    -- gefragt wird an jeder Stelle nur „darf der Automat hier schreiben?", und
    -- ein boolean kann diese Frage nicht mehrdeutig beantworten.
    geprueft boolean not null default false,

    -- Wer die Fassung zuletzt von Hand korrigiert hat. NULL, solange sie
    -- maschinell ist. `on delete set null` aus demselben Grund wie bei
    -- `announcements.erstellt_von`: die Fassung gehört der Plattform, nicht der
    -- Person.
    geprueft_von uuid references auth.users (id) on delete set null,
    geprueft_am timestamptz,

    -- Fingerabdruck des QUELLTEXTES, aus dem diese Fassung entstanden ist
    -- (sha256 über Titel + Kurztext + Inhalt des Originals). Beantwortet die
    -- Frage, die sonst niemand beantworten kann: „Ist diese Übersetzung noch
    -- aktuell, oder wurde das Original seither geändert?" Ohne ihn müsste man
    -- Zeitstempel vergleichen — und `updated_at` ändert sich auch, wenn nur
    -- `als_popup` umgeschaltet wurde. Der Hash ändert sich ausschließlich,
    -- wenn sich der TEXT geändert hat.
    --
    -- Er treibt zwei Dinge:
    --   • Wurzel 2 (Idempotenz): ein zweiter Übersetzungslauf mit unverändertem
    --     Quelltext findet den gleichen Hash und macht NICHTS — kein zweiter
    --     kostenpflichtiger API-Aufruf bei Doppelklick oder Retry.
    --   • Die Anzeige „veraltet" im Backoffice: eine GEPRÜFTE Fassung, deren
    --     quelle_hash nicht mehr zum aktuellen Original passt, wird nicht
    --     überschrieben (der Schutz gilt), aber sichtbar als veraltet markiert.
    --     Der Redakteur entscheidet dann selbst.
    quelle_hash text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.announcement_translations is
    'Fassungen einer Ankuendigung je EU-Amtssprache (0347). `geprueft = true` '
    'heisst: von einem Menschen verantwortet — maschinelle Laeufe fassen die '
    'Zeile nicht mehr an. Fuer anon/authenticated vollstaendig gesperrt '
    '(Wurzel 6), wie die Mutter-Tabelle.';
comment on column public.announcement_translations.geprueft is
    'true = menschlich korrigiert und damit vor automatischer Ueberschreibung '
    'geschuetzt. Jedes maschinelle UPDATE traegt `where geprueft = false`.';
comment on column public.announcement_translations.quelle_hash is
    'sha256 des Quelltextes (Titel+Kurztext+Inhalt), aus dem diese Fassung '
    'entstand. Weicht er vom aktuellen Original ab, ist die Fassung veraltet. '
    'Traegt zugleich die Idempotenz: gleicher Hash = kein erneuter API-Aufruf.';
comment on column public.announcement_translations.inhalt_html is
    'Nach der Rueckkehr vom Uebersetzungsdienst erneut per nh3-Allowlist '
    'gesaeubert — die Antwort eines Fremddienstes ist Fremd-Input (Wurzel 8).';

-- Wurzel 2 als DB-Backstop: Doppelklick auf „Speichern" und ein Retry nach
-- Timeout starten den Uebersetzungslauf real zweimal. Ohne diesen Index
-- entstuenden zwei Zeilen fuer dieselbe Sprache — und der Lesepfad
-- (`.limit(1)`) zeigte danach zufaellig die eine oder die andere. Der Service
-- schreibt per upsert auf genau diesen Konflikt.
create unique index if not exists announcement_translations_uq
    on public.announcement_translations (announcement_id, sprache);

-- Der EINE Lesezugriff des Dashboards: „die Fassung dieser Ankuendigung in
-- meiner Sprache". Deckt der UNIQUE-Index bereits ab; der zusaetzliche Index
-- unten dient dem Backoffice-Ueberblick („welche Sprachen fehlen, welche sind
-- geprueft") ohne Sortier-Schritt.
create index if not exists announcement_translations_status_idx
    on public.announcement_translations (announcement_id, geprueft);


-- == Wurzel 6: DB-Direktpfad (PostgREST/Realtime mit anon-Key) ===============
-- Dieselbe Begruendung wie bei `announcements` (0337), und sie wiegt hier
-- GENAUSO schwer: die Uebersetzungen tragen denselben Inhalt, nur 24-fach.
-- Waere diese Tabelle offen, waere der Riegel auf der Mutter-Tabelle wertlos —
-- ein Entwurf („Preiserhoehung zum 1.10.") liesse sich einfach ueber seine
-- Uebersetzung lesen, und ein `update` schriebe eine Falschmeldung im Namen
-- der Plattform in jedes Kundendashboard. Nur service_role arbeitet hier.
alter table public.announcement_translations enable row level security;

revoke all on public.announcement_translations from anon, authenticated;

-- Restriktiver Deny-all-Riegel, bewusst `for all` (nicht nur `for select`):
-- sonst waere der SCHREIB-Pfad offen, sobald jemand spaeter ein Grant
-- zurueckgibt. `false` kann von keiner spaeteren permissiven Policy
-- uebersteuert werden.
drop policy if exists announcement_translations_deny_all
    on public.announcement_translations;
create policy announcement_translations_deny_all
    on public.announcement_translations
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);

-- Dritter Riegel (Zielgruppe), identisch zur Mutter-Tabelle: greift erst,
-- falls jemand spaeter bewusst ein `grant select` zurueckgibt UND die
-- Deny-all-Policy lockert — dann steht immer noch „nur admin/co_admin".
drop policy if exists announcement_translations_nur_leitung
    on public.announcement_translations;
create policy announcement_translations_nur_leitung
    on public.announcement_translations
    as restrictive
    for all
    to anon, authenticated
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (public.current_user_role() in ('admin', 'co_admin'));

-- BEWUSST KEINE Realtime-Publikation — dieselbe Begruendung wie in 0337: ein
-- Abo braeuchte `grant select to authenticated` und oeffnete damit genau das,
-- was der Block oben schliesst. Ankuendigungen erscheinen beim naechsten
-- Vollladen des Dashboards, nicht live.
