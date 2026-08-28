-- 0464 — Geschäftsprofil des KI-Assistenten: was NICHT abgefragt wird
--
-- Duda (und darüber Hostaway) zwingt den Kunden beim ersten Klick auf eine KI-
-- Funktion in einen Assistenten: „AI Business Profile" — Name, Branche,
-- Zielgruppe, Tonfall, Alleinstellung. Ohne ausgefülltes Profil läuft dort
-- nichts Erzeugendes. Das ist der schlechtere Weg, und zwar aus zwei Gründen:
--
--   1. Wir WISSEN das meiste schon. Der Betriebsname steht in `tenants`, die
--      Anschrift und die Firmierung in `tenant_billing_profile`, die
--      Unterkunftsart, die Betten, die Ausstattung und die Lage in
--      `properties`, die Zusammengehörigkeit in `buildings`. Es abzufragen
--      heißt, den Kunden nach etwas zu fragen, das er bereits eingetippt hat —
--      und es heißt, eine ZWEITE Wahrheit anzulegen: wer umzieht, ändert die
--      Adresse im Konto und wundert sich, dass die KI die alte Stadt erwähnt.
--      Dieselbe Überlegung wie bei den Firmendaten der Website
--      (`site_config/konto_daten.py`).
--
--   2. Ein Pflicht-Assistent vor der ersten Nutzung ist eine Hürde vor einem
--      Knopf, der in zwei Sekunden hätte helfen können.
--
-- Diese Tabelle enthält deshalb NUR das, was aus den Stammdaten NICHT ableitbar
-- ist — eine Haltung, keine Tatsache:
--
--   * der Tonfall, in dem der Betrieb schreiben will,
--   * die Zielgruppe, wenn sie enger ist als „Gäste",
--   * das Alleinstellungsmerkmal in eigenen Worten,
--   * Wörter, die nie vorkommen sollen.
--
-- Alles vier ist OPTIONAL. Ist die Zeile leer oder gar nicht vorhanden, läuft
-- die Erzeugung trotzdem — sie stützt sich dann allein auf die Stammdaten.
-- KEIN Feld hier hat einen erfundenen Vorgabewert (Wurzel 4): ein
-- voreingestellter Tonfall „freundlich" wäre eine Behauptung über einen
-- Betrieb, den wir nicht kennen.
--
-- WAS HIER NICHT STEHT, und mit Absicht: eine Kopie von Name, Ort, Betten oder
-- Ausstattung. Die wird bei JEDEM Aufruf frisch gelesen
-- (`site_config/ki_profil.py`). Ein Schnappschuss wäre am Tag nach der ersten
-- Änderung falsch, und die KI würde ihn für bare Münze nehmen.

create table if not exists public.site_ai_profile (
    -- Ein Profil je Betrieb. Kein eigenes `id`: die Zeile IST der Betrieb,
    -- und ein zweites Profil desselben Betriebs wäre eine Frage, die niemand
    -- beantworten kann.
    tenant_id   uuid primary key
                references public.tenants (id) on delete cascade,

    -- Tonfall. Freitext und keine Werteliste, weil ein Betrieb ihn besser
    -- beschreiben kann als eine Auswahl mit fünf Adjektiven — „ruhig und
    -- sachlich, wir verkaufen keine Erlebnisse" ist eine bessere Anweisung an
    -- ein Sprachmodell als das Wort „sachlich". Die UI schlägt vier
    -- Formulierungen vor und lässt sie überschreiben.
    ton         text,

    -- An wen sich die Website richtet, wenn es enger ist als „Gäste":
    -- Familien mit kleinen Kindern, Wanderer, Geschäftsreisende, Hundehalter.
    zielgruppe  text,

    -- Was diesen Betrieb von der Nachbarunterkunft unterscheidet. Das ist der
    -- einzige Punkt, den eine Maschine WIRKLICH nicht aus den Stammdaten holen
    -- kann: „30 m zum Wasser" steht in der Beschreibung, „seit 1974 in
    -- Familienhand" nirgends.
    alleinstellung text,

    -- Wörter, die nie vorkommen sollen. In der Praxis der wichtigste Punkt
    -- gegen KI-Sprache: „einzigartig", „Oase", „eintauchen", „Juwel". Als
    -- Liste und nicht als Freitext, damit die Prüfung nach der Erzeugung
    -- mechanisch ist und nicht wieder ein Sprachmodell braucht.
    verbotene_woerter text[] not null default '{}',

    -- Freie Zusatzanweisung für alles, was in keines der vier Felder passt.
    notiz       text,

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    -- Längen als Deckel gegen den unbegrenzten Bereich (Wurzel 8): jedes Feld
    -- wandert in JEDEN Prompt, also in jeden bezahlten Aufruf. Ein Betrieb,
    -- der seinen halben Prospekt in `notiz` klebt, würde sonst jeden Aufruf
    -- verteuern und den Kontextdeckel des Clients reißen.
    constraint site_ai_profile_ton_laenge check (
        ton is null or char_length(ton) <= 300
    ),
    constraint site_ai_profile_zielgruppe_laenge check (
        zielgruppe is null or char_length(zielgruppe) <= 300
    ),
    constraint site_ai_profile_alleinstellung_laenge check (
        alleinstellung is null or char_length(alleinstellung) <= 600
    ),
    constraint site_ai_profile_notiz_laenge check (
        notiz is null or char_length(notiz) <= 1200
    ),
    constraint site_ai_profile_verbotene_woerter_deckel check (
        array_length(verbotene_woerter, 1) is null
        or array_length(verbotene_woerter, 1) <= 50
    )
);

comment on table public.site_ai_profile is
    'Haltung des Betriebs für den KI-Assistenten des Website-Baukastens: '
    'Tonfall, Zielgruppe, Alleinstellung, verbotene Wörter. Enthält BEWUSST '
    'keine Stammdaten — Name, Ort, Betten und Ausstattung werden bei jedem '
    'Aufruf frisch aus tenants/tenant_billing_profile/properties gelesen, '
    'damit es keine zweite Wahrheit gibt.';
comment on column public.site_ai_profile.verbotene_woerter is
    'Wörter, die nicht vorkommen sollen. Wird NACH der Erzeugung mechanisch '
    'geprüft, nicht nur im Prompt gebeten — ein Sprachmodell hält sich an '
    'Verbote ungefähr, und "ungefähr" ist bei einem Markenwort zu wenig.';

alter table public.site_ai_profile enable row level security;

drop policy if exists site_ai_profile_tenant on public.site_ai_profile;
create policy site_ai_profile_tenant on public.site_ai_profile
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Diese Zeile beschreibt, wie ein Betrieb auftreten will, und sie
-- geht in JEDEN bezahlten KI-Aufruf ein. Wer sie über den Direktpfad schreiben
-- könnte, könnte den Prompt jedes Kollegen umschreiben — also eine
-- Prompt-Injection, die dauerhaft in der Datenbank sitzt und bei jedem
-- künftigen Aufruf mitläuft. Deshalb: kein Recht für anon/authenticated,
-- weder lesend noch schreibend. Gelesen und geschrieben wird ausschließlich
-- über die API mit MANAGE_SITE_CONFIG.
revoke select, insert, update, delete on public.site_ai_profile
    from anon, authenticated;

drop policy if exists site_ai_profile_kein_direktpfad on public.site_ai_profile;
create policy site_ai_profile_kein_direktpfad on public.site_ai_profile
    as restrictive for all to anon, authenticated
    using (false) with check (false);

comment on policy site_ai_profile_kein_direktpfad on public.site_ai_profile is
    'Restriktiv für ALLE Richtungen, nicht nur für select: der Inhalt dieser '
    'Zeile wird Teil jedes Prompts. Eine nur lesende Sperre ließe den '
    'Schreibpfad tenant-weit offen (Wurzel 6).';

-- KEIN Eintrag in supabase_realtime. Das Profil ändert ein Mensch alle paar
-- Monate; ein Abo darauf wäre eine Attrappe mit Betriebskosten. Und ohne
-- select-Grant für authenticated könnte es ohnehin nie eine Zeile liefern —
-- genau die stumme Attrappe, vor der das Qualitätsgate warnt.
