-- „Nachricht vor der Buchung" — die zweite Voraussetzung, die Airbnb kennt.
--
-- QUELLE. Airbnb führt unter „Buchungseinstellungen → Voraussetzungen für
-- Gäste" GENAU ZWEI optionale Bedingungen (Hilfe-Artikel 484, deutsche
-- Fassung, abgerufen 17.09.2026):
--
--     „Erfolgreich abgeschlossene Aufenthalte"   → 0718
--     „Nachricht vor der Buchung"                → diese Migration
--
-- Wörtlich: der Gast muss „read and respond to questions in an automated
-- pre-booking message that you create". Der Gastgeber schreibt also eine Frage,
-- und ohne Antwort gibt es keine Sofortbuchung.
--
-- WARUM DAS KEINE BLOSSE TEXTZEILE IST. Die Antwort muss den Gastgeber auch
-- ERREICHEN, sonst ist die Frage eine Frage ins Leere — genau die Sorte
-- halbfertige Funktion, die überall funktioniert und nirgends wirkt. Sie
-- gehört deshalb an die Buchung, nicht in ein Protokoll.
--
-- UND DIE FRAGE WANDERT MIT. Gespeichert wird nicht nur die Antwort, sondern
-- auch die Frage, wie sie zum Zeitpunkt der Buchung lautete. Ändert der
-- Gastgeber sie später, stünde sonst eine Antwort ohne ihre Frage da — lesbar,
-- plausibel und falsch (dieselbe Klasse wie Wurzel 5b: ein Wert, der stimmt,
-- aber etwas anderes beschreibt, als er zu beschreiben scheint).

-- ---------------------------------------------------------------------------
-- Teil 1 — die Frage des Betriebs
-- ---------------------------------------------------------------------------
-- NULL oder leer heißt: keine Frage, die Bedingung ist aus. Kein eigener
-- Schalter daneben — zwei Felder, die dasselbe ausdrücken, laufen auseinander
-- (ein gesetzter Schalter ohne Text wäre eine Bedingung, die niemand erfüllen
-- kann, weil nichts gefragt wird).
alter table public.tenants
    add column if not exists pre_booking_question text
        check (pre_booking_question is null or length(pre_booking_question) <= 1000);

alter table public.properties
    add column if not exists pre_booking_question text
        check (pre_booking_question is null or length(pre_booking_question) <= 1000);

comment on column public.tenants.pre_booking_question is
    'Airbnb „Nachricht vor der Buchung": Frage, die ein Gast vor der '
    'Sofortbuchung beantworten muss. NULL/leer = keine Frage. Vorgabe des '
    'Betriebs; properties.pre_booking_question gilt für die einzelne Buchung.';
comment on column public.properties.pre_booking_question is
    'Wie tenants.pre_booking_question, je Objekt. Wirkt nur bei '
    'booking_mode=instant — bei einer Anfrage schreibt der Gast ohnehin.';

-- ---------------------------------------------------------------------------
-- Teil 2 — Antwort und Frage an der Buchung
-- ---------------------------------------------------------------------------
-- Die Antwort ist Gasttext und wird serverseitig gedeckelt (Wurzel 8); der
-- CHECK ist der Backstop in der DB, falls je ein anderer Pfad schreibt.
alter table public.reservations
    add column if not exists pre_booking_question text,
    add column if not exists pre_booking_answer text
        check (pre_booking_answer is null or length(pre_booking_answer) <= 2000);

comment on column public.reservations.pre_booking_answer is
    'Antwort des Gastes auf die „Nachricht vor der Buchung". NULL, wenn das '
    'Objekt keine Frage stellt.';
comment on column public.reservations.pre_booking_question is
    'Die Frage, WIE SIE BEI DER BUCHUNG LAUTETE. Bewusst mitgeschrieben und '
    'nicht nachgeschlagen: ändert der Gastgeber seine Frage, stünde sonst eine '
    'Antwort ohne ihre Frage da.';

-- ---------------------------------------------------------------------------
-- Teil 3 — Vererbung: ein Trigger für die ganze Entscheidung
-- ---------------------------------------------------------------------------
-- Der Trigger aus 0718 vererbte nur die Zielgruppe. Die Frage gehört zur
-- selben Entscheidung und muss mit ihr wandern — zwei Trigger für eine
-- Entscheidung wären zwei Gelegenheiten, eine Hälfte zu vergessen (Wurzel 1).
-- Deshalb wird er ERSETZT und passend benannt, nicht ein zweiter danebengelegt.
--
-- Unverändert bleibt: der Buchungsmodus wird NICHT vererbt. Nach ihm fragt der
-- Objekt-Assistent ausdrücklich, und ein Trigger, der eine eben getroffene
-- Wahl überschreibt, ist schlimmer als gar keiner.
create or replace function public.properties_buchungsregeln_erben()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    vorgabe_zielgruppe public.instant_booking_audience;
    vorgabe_frage      text;
begin
    select t.instant_booking_audience, t.pre_booking_question
      into vorgabe_zielgruppe, vorgabe_frage
      from public.tenants t
     where t.id = new.tenant_id;

    -- Kein Betrieb gefunden (dürfte nicht vorkommen): nichts erfinden, die
    -- Spalten-Defaults gelten weiter.
    if vorgabe_zielgruppe is not null then
        new.instant_booking_audience := vorgabe_zielgruppe;
    end if;
    -- Die Frage darf ausdrücklich NULL sein („keine Frage"), deshalb wird sie
    -- immer übernommen, sobald der Betrieb existiert — eine NULL-Prüfung wie
    -- oben würde „der Betrieb fragt nichts" nie durchreichen.
    if found then
        new.pre_booking_question := vorgabe_frage;
    end if;
    return new;
end;
$$;

comment on function public.properties_buchungsregeln_erben() is
    'Ein neues Objekt übernimmt die Buchungsregeln seines Betriebs: '
    'Zielgruppe der Sofortbuchung und die Nachricht vor der Buchung. Der '
    'Buchungsmodus wird bewusst NICHT vererbt — nach ihm fragt der '
    'Objekt-Assistent ausdrücklich.';

revoke execute on function public.properties_buchungsregeln_erben()
    from anon, authenticated;

drop trigger if exists properties_buchungszielgruppe_erben on public.properties;
drop trigger if exists properties_buchungsregeln_erben on public.properties;
create trigger properties_buchungsregeln_erben
    before insert on public.properties
    for each row execute function public.properties_buchungsregeln_erben();

-- Die Vorgängerfunktion aus 0718 hat keinen Trigger mehr und wird entfernt —
-- eine tote SECURITY-DEFINER-Funktion ist Angriffsfläche ohne Nutzen.
drop function if exists public.properties_buchungszielgruppe_erben();
