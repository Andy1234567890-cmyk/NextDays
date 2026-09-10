-- 0629 — Geburtsdatum des Verkaeufers (RS_BIRTH_DATE).
--
-- WARUM: Die amtliche CSV-Vorlage von Skattestyrelsen fuehrt das Feld
-- RS_BIRTH_DATE fuer jede Privatperson (RS_IND_Individual_Seller) als
-- PFLICHT:
--
--   "Individual seller birth date | Obligatorisk. Angives i formatet
--    DD-MM-YYYY | Date | Kardinalitaet 1..1"
--
-- In `owners` gab es dafuer bisher kein Feld. Ohne Geburtsdatum kann fuer
-- keine Privatperson eine Meldung erzeugt werden.
--
-- WARUM NICHT AUS DER CPR-NUMMER ABLEITEN: In den ersten sechs Ziffern
-- einer CPR-Nummer steckt zwar TTMMJJ, und das Jahrhundert folgt aus der
-- siebten Ziffer. Eine Steuermeldung darf aber kein gerechnetes
-- Geburtsdatum tragen: Rechnet die Regel falsch, steht ein falsches Datum
-- in der Akte einer echten Person, und niemand sieht es der Zahl an.
-- Entscheidung des Betriebs am 10.09.2026: Das Feld wird erfasst.

alter table public.owners
    add column if not exists date_of_birth date;

comment on column public.owners.date_of_birth is
    'Geburtsdatum des Verkaeufers. Geht als RS_BIRTH_DATE in die '
    'DAC7-Meldung und ist dort fuer jede Privatperson Pflicht. Nicht aus '
    'der CPR-Nummer ableiten — erfassen.';

-- Ein Geburtsdatum in der Zukunft oder vor 1900 ist ein Tippfehler, kein
-- Datum. Die Datenbank haelt das auch gegen den Direktpfad (Wurzel 6).
alter table public.owners
    drop constraint if exists owners_geburtsdatum_plausibel;
alter table public.owners
    add constraint owners_geburtsdatum_plausibel
    check (
        date_of_birth is null
        or (date_of_birth > date '1900-01-01' and date_of_birth < current_date)
    );

-- Die Arbeitsliste vor der Meldung: Privatpersonen ohne Geburtsdatum.
-- `company is null` unterscheidet Person von Gesellschaft — nur die Person
-- braucht das Feld.
create index if not exists owners_ohne_geburtsdatum_idx
    on public.owners (tenant_id)
    where date_of_birth is null and company is null;
