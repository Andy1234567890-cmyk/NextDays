-- 0168_booking_conditions_lodgify_parity.sql — fehlende Konditions-Felder
--
-- Ergänzt booking_conditions um die Detail-Optionen aus dem Lodgify-Editor, die
-- im ersten Wurf (0165) noch fehlten:
--   * deposit_amount_type   — Kautionsbetrag als absoluter Betrag ODER % des
--                             Buchungsbetrags.
--   * deposit_method 'manual' — „Kaution manuell erheben und rückerstatten"
--                             (neben 'preauth' = auf Karte autorisieren).
--   * balance_timing        — Fälligkeits-Achse der Restzahlung: Tage vor Anreise
--                             / nach Anreise / vor Abreise / nicht (extern)
--                             geplant. Bisher implizit „vor Anreise".
--
-- booking_conditions ist bereits revoke/RLS-geschützt (0165) — neue Spalten
-- erben das. Beträge/Prozent aus den Daten, kein Hardcode (Wurzel 4).

-- Kautions-Methode um 'manual' erweitern. Der bestehende CHECK erlaubt nur
-- 'preauth' → droppen und neu setzen (idempotent-freundlich formuliert).
alter table public.booking_conditions
    drop constraint if exists booking_conditions_deposit_method_check;
alter table public.booking_conditions
    add constraint booking_conditions_deposit_method_check
        check (deposit_method in ('preauth', 'manual'));

alter table public.booking_conditions
    -- Kautionsbetrag-Typ: fester Betrag oder Prozent des Buchungsbetrags.
    add column if not exists deposit_amount_type text
        not null default 'absolute'
        check (deposit_amount_type in ('absolute', 'percent')),
    -- Fälligkeits-Achse der Restzahlung. 'days_before_arrival' = bisheriges
    -- Verhalten (Default); 'not_scheduled' = extern/manuell (kein Auto-Charge).
    add column if not exists balance_timing text
        not null default 'days_before_arrival'
        check (balance_timing in
               ('days_before_arrival', 'days_after_arrival',
                'days_before_departure', 'not_scheduled')),
    -- Erste-Zahlung-Betragstyp (analog Kaution): % des Buchungsbetrags (Default,
    -- bisheriges Verhalten) oder fester Betrag.
    add column if not exists first_payment_amount_type text
        not null default 'percent'
        check (first_payment_amount_type in ('percent', 'absolute'));

comment on column public.booking_conditions.balance_timing is
  'Fälligkeits-Achse der Restzahlung; not_scheduled = nicht automatisch (extern).';
