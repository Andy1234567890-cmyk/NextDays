-- 0674_kontenplan_number_sequences_grenzen.sql — Grenzen für editierbare Nummernkreise
--
-- WARUM: Mit `PATCH /buchhaltung/number-sequences/{sequence}` (Bereich
-- »kontenplan«) werden Präfix, Suffix, Stellenzahl und — nur solange noch
-- keine Nummer gezogen wurde — der Startwert vom Betrieb änderbar. Bis dahin
-- schrieb ausschließlich `next_document_number()` in diese Tabelle (0025/0105),
-- und die Spalten hatten keine Wertgrenzen. Der Service prüft (422), die DB
-- hält als Backstop dagegen:
--   * `padding` 1..10 — `lpad` mit 0 oder 200 Stellen ergäbe leere bzw.
--     absurde Belegnummern.
--   * `next_value` >= 1 — der Zähler kennt keine Null und kein Negativ.
--   * `prefix`/`suffix` höchstens 20 Zeichen (Belegnummer bleibt lesbar; die
--     Aufdruck-Vorlagen rechnen mit kurzen Nummern).
--   * NEU `start_value`: der Wert, mit dem der Kreis begonnen hat. „Noch keine
--     Nummer gezogen" heißt `next_value = start_value` — nur dann darf der
--     Startwert geändert werden (sonst 409). Ohne diese Spalte wäre ein Kreis
--     mit Startwert 100 und keiner Ziehung nicht von einem mit 99 gezogenen
--     Belegen zu unterscheiden. Bestand: start_value = 1 (0025-Vorgabe).
-- Nichts wird eingespielt, was bestehende Zeilen bricht: Vorgaben sind
-- prefix 'RE-', padding 4, suffix '', next_value >= 1 (0025).
--
-- Rechte bleiben wie 0224/0337: nur der Server schreibt und liest.

alter table public.number_sequences
    add column if not exists start_value integer not null default 1;

alter table public.number_sequences
    drop constraint if exists number_sequences_start_value_positiv;
alter table public.number_sequences
    add constraint number_sequences_start_value_positiv
    check (start_value >= 1 and start_value <= next_value);

alter table public.number_sequences
    drop constraint if exists number_sequences_padding_grenzen;
alter table public.number_sequences
    add constraint number_sequences_padding_grenzen
    check (padding between 1 and 10);

alter table public.number_sequences
    drop constraint if exists number_sequences_next_value_positiv;
alter table public.number_sequences
    add constraint number_sequences_next_value_positiv
    check (next_value >= 1);

alter table public.number_sequences
    drop constraint if exists number_sequences_praefix_suffix_laenge;
alter table public.number_sequences
    add constraint number_sequences_praefix_suffix_laenge
    check (length(prefix) <= 20 and length(suffix) <= 20);
