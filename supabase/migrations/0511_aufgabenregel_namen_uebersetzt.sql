-- 0511 — Regelnamen in der Sprache des Lesers.
--
-- DAS PROBLEM: `task_rules.name` ist EIN Freitext in EINER Sprache — der, in
-- der ihn jemand eingetippt hat. Gelesen wird er von Menschen mit anderen
-- Sprachen. Live gemessen (31.08.2026): der Mandant AirSmil hat 26 Nutzer in
-- ZWEI Sprachen (`da` und `de`) und führt zwölf Regeln, deren Namen GEMISCHT
-- sind — „Anreisecheck" und „Endreinigung" neben „Vinduer 8-uger",
-- „Viceværtrunde hele året", „Reng T" und „Velk J" (dänische Kurzformen für
-- rengøring und velkomst). Im deutschsprachigen Dashboard stehen die dänischen
-- Kürzel, im dänischen Portal die deutschen Wörter. Beide Richtungen sind
-- gleichzeitig falsch, und kein einzelner Sprachwert am Betrieb kann das
-- richten.
--
-- Der Anlass war die Bestellliste aus 0510: dort wählt ein Eigentümer eine
-- Leistung aus, die er bezahlt. „Reng J" ist dafür keine Beschriftung. Aber
-- das Problem ist älter und größer als die Bestellliste — derselbe Name steht
-- im Aufgabenkalender, in der Aufgabenliste und in der Zuweisungsmail an die
-- Reinigungskraft, die womöglich eine dritte Sprache spricht.
--
-- WARUM NICHT DIE REGEL UMBENENNEN: Das verschiebt das Problem nur. Wird
-- „Reng J" zu „Reinigung J", liest es der dänische Eigentümer auf Deutsch —
-- und der Betrieb hat seine eigene, eingespielte Bezeichnung verloren. Eine
-- deutsche Agentur, die dänische Eigentümer betreut, braucht BEIDES: ihren
-- internen Namen und eine Fassung je Leser.
--
-- WARUM KEIN AUSWAHLFELD „Leistungsart": Ein fester Katalog (Reinigung,
-- Anreise, Wäsche …) wäre 24-sprachig übersetzbar, aber er zwingt jede Regel
-- in eine von n Schubladen. Ein Betrieb, der „Wintercheck Heizung" führt, hätte
-- keine passende — und bekäme entweder eine erfundene Zuordnung oder gar keine
-- Übersetzung. Der Freitext bleibt die Wahrheit, er wird übersetzt.
--
-- DIE BAUFORM ist die von 0347 (Ankündigungen) und 0476 (Website-Seiten), und
-- zwar bewusst dieselbe bis ins Detail: eine Zeile je (Regel, Sprache), ein
-- `geprueft`-Riegel gegen maschinelles Überschreiben, ein `quelle_hash` für
-- Idempotenz und Veraltungs-Erkennung. Ein drittes eigenes Muster daneben wäre
-- die dritte Stelle, an der dieselbe Frage anders beantwortet wird.

create table if not exists public.task_rule_translations (
    id uuid primary key default gen_random_uuid(),

    rule_id uuid not null
        references public.task_rules (id) on delete cascade,

    -- ISO-639-1 der 24 EU-Amtssprachen, deckungsgleich mit `web/i18n/
    -- locales.ts` und den Sprachdateien. CHECK statt Stammdatentabelle: die
    -- Liste ändert sich nur, wenn die EU eine Amtssprache aufnimmt.
    sprache text not null check (sprache in (
        'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
        'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
    )),

    -- Die Fassung des Regelnamens in dieser Sprache. NOT NULL: eine Zeile ohne
    -- Namen ist keine Fassung — der Leser bekäme eine leere Beschriftung, und
    -- der Lesepfad müsste doch wieder auf den Originalnamen zurückfallen.
    name text not null,

    -- ANGELEGT, ABER (NOCH) UNGENUTZT. Die Beschreibung wird bewusst NICHT
    -- uebersetzt: sie ist ein internes Arbeitsdetail („Morten", „1.10.-31.3.")
    -- und live in einer ANDEREN Sprache verfasst als der Name derselben Regel
    -- („Reng T" mit „Endreinigung"). Beide aus einer Ausgangssprache zu
    -- uebersetzen hiesse, die Haelfte falsch zu behandeln.
    --
    -- Die Spalte bleibt trotzdem stehen: nullable, ohne Verwender, ohne
    -- Kosten. Sie zu entfernen waere eine weitere Migration fuer nichts, und
    -- sollte die Beschreibung spaeter doch uebersetzt werden, ist sie da.
    description text,

    -- DER SCHUTZ. false = maschinell erzeugt, jederzeit neu übersetzbar.
    -- true = ein Mensch hat die Fassung im Dashboard korrigiert; kein
    -- automatischer Lauf fasst sie mehr an. Jedes maschinelle UPDATE trägt
    -- `where geprueft = false`.
    geprueft boolean not null default false,
    geprueft_von uuid references auth.users (id) on delete set null,
    geprueft_am timestamptz,

    -- sha256 über den Quelltext (Name + Beschreibung), aus dem diese Fassung
    -- entstand. Zwei Aufgaben:
    --   * Idempotenz (Wurzel 2): gleicher Hash = kein zweiter Modellaufruf.
    --     Bei 24 Sprachen ist ein versehentlicher zweiter Lauf 24 bezahlte
    --     Aufrufe.
    --   * Veraltung: wurde die Regel umbenannt, passt der Hash nicht mehr. Eine
    --     GEPRÜFTE Fassung wird trotzdem nicht überschrieben (der Riegel gilt),
    --     aber sie ist als veraltet erkennbar.
    quelle_hash text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.task_rule_translations is
    'Fassungen eines Aufgabenregel-Namens je EU-Amtssprache (0511). Der '
    'Originalname bleibt in task_rules.name — er ist die interne Bezeichnung '
    'des Betriebs. Diese Tabelle trägt, was ein Leser in SEINER Sprache sieht.';
comment on column public.task_rule_translations.geprueft is
    'true = menschlich korrigiert und vor automatischer Ueberschreibung '
    'geschuetzt. Jedes maschinelle UPDATE traegt `where geprueft = false`.';
comment on column public.task_rule_translations.quelle_hash is
    'sha256 aus Name+Beschreibung des Originals. Weicht er ab, ist die Fassung '
    'veraltet. Traegt zugleich die Idempotenz des Uebersetzungslaufs.';

-- Wurzel 2 als DB-Backstop: ein Doppelklick auf „Speichern" startet den Lauf
-- real zweimal. Ohne diesen Index entstuenden zwei Zeilen je Sprache, und der
-- Lesepfad zeigte danach zufaellig die eine oder die andere.
create unique index if not exists task_rule_translations_uq
    on public.task_rule_translations (rule_id, sprache);

-- Der eine Lesezugriff: „alle Fassungen dieser Regeln in MEINER Sprache" —
-- die Aufgabenliste holt sie fuer alle sichtbaren Regeln auf einmal.
create index if not exists task_rule_translations_sprache_idx
    on public.task_rule_translations (sprache, rule_id);

-- == Wurzel 6: DB-Direktpfad (PostgREST/Realtime mit anon-Key) ===============
-- `task_rules` selbst ist fuer authenticated lesbar (die Aufgabenverwaltung
-- laeuft ueber RLS mit Tenant-Policy). Diese Tabelle traegt DENSELBEN Inhalt,
-- nur uebersetzt — sie muss also genau denselben Riegel haben, sonst waere der
-- Schutz der Mutter-Tabelle ueber den Umweg der Uebersetzung zu umgehen.
--
-- Die Mandantengrenze steht ueber die Mutter-Tabelle: die Zeile selbst traegt
-- KEINE tenant_id. Eine zweite Kopie der Zugehoerigkeit koennte von der ersten
-- abweichen, und dann waere unklar, welche gilt.
alter table public.task_rule_translations enable row level security;

drop policy if exists task_rule_translations_tenant on public.task_rule_translations;
create policy task_rule_translations_tenant on public.task_rule_translations
    for all
    using (
        exists (
            select 1
            from public.task_rules r
            where r.id = task_rule_translations.rule_id
              and r.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1
            from public.task_rules r
            where r.id = task_rule_translations.rule_id
              and r.tenant_id = public.current_tenant_id()
        )
    );

-- Lesen ja (die Aufgaben-UI zeigt die Fassung), SCHREIBEN nur der Server:
-- eine Fassung entsteht aus einem bezahlten Modellaufruf oder aus einer
-- geprueften Korrektur — beides gehoert nicht in die Hand eines Clients, der
-- sich sonst eine beliebige Beschriftung fuer eine fremde Regel eintragen
-- koennte.
revoke insert, update, delete on public.task_rule_translations
    from anon, authenticated;
grant select on public.task_rule_translations to authenticated;

-- Realtime: die Aufgaben-UI zeigt die Fassung, also muss eine nachgelieferte
-- Uebersetzung ankommen, ohne dass jemand neu laedt. Grant steht oben, hier
-- die zweite Haelfte — ohne Publikations-Mitgliedschaft waere das Abo eine
-- stumme Attrappe (CLAUDE.md, Realtime).
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'task_rule_translations'
    ) then
        alter publication supabase_realtime add table public.task_rule_translations;
    end if;
end $$;

-- Die Ausgangssprache der Regel — NULLABLE und ohne Default.
--
-- Der naheliegende Griff waere `default 'de'` oder „nimm die Sprache des
-- Mandanten". Beides ist an den echten Daten widerlegt. Gemessen am 31.08.2026
-- steht der Mandant AirSmil auf `default_language = 'de'` und fuehrt zwoelf
-- Regeln, die GEMISCHT benannt sind:
--
--     deutsch:  Anreisecheck, Endreinigung
--     daenisch: Vicevaertrunde hele aaret, Vinduer 8-uger, Reng T, Velk J, …
--
-- Ein Default haette also die Haelfte falsch etikettiert, und zwar unsichtbar:
-- „uebersetze aus dem Deutschen" auf ein daenisches „Vinduer 4-uger" liefert
-- kein Fehlersignal, sondern eine plausible Falschuebersetzung (Wurzel 4 —
-- und Wurzel 5b in ihrer Form: ein Wert, den niemand als falsch erkennt).
--
-- NULL heisst deshalb ehrlich „unbekannt". Der Uebersetzungslauf ueberspringt
-- solche Regeln und meldet sie LAUT, statt zu raten; das Dashboard fragt die
-- Sprache beim naechsten Bearbeiten der Regel ab. Eine neu angelegte Regel
-- bekommt sie vom Client mitgegeben (die Oberflaeche kennt ihre eigene
-- Anzeigesprache).
alter table public.task_rules
    add column if not exists quellsprache text
        check (quellsprache in (
            'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
            'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
        ));

comment on column public.task_rules.quellsprache is
    'In welcher Sprache `name` verfasst ist (0511). NULL = '
    'unbekannt (Altbestand): der Uebersetzungslauf ueberspringt die Regel und '
    'meldet sie, statt eine Ausgangssprache zu raten. Ein Default waere hier '
    'nachweislich falsch — ein Betrieb fuehrt deutsche UND daenische Regeln '
    'nebeneinander (gemessen 31.08.2026).';
