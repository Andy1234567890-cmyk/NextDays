-- 0346_owner_statements_betraege_nullable.sql
-- Abrechnungs-Blocker: `owner_statements` liess sich fuer keinen Tenant anlegen.
--
-- BEFUND (live reproduziert am 09.08.2026 gegen die Server-DB, Tenant AirSmil):
--   ERROR: null value in column "total_price" of relation "owner_statements"
--          violates not-null constraint   (SQLSTATE 23502)
-- `_refresh_summary` schreibt die frisch berechneten Summen in den Entwurf.
-- `_compute_summary` liefert fuer `total_price` und `pm_payout` bewusst NULL,
-- wenn es die Zahl NICHT gibt. Die Spalten waren aber `not null default 0`.
--
-- Zwei fachlich verschiedene NULL-Faelle, beide echt:
--   * total_price — der Gast-Bruttopreis ist nicht durchgaengig bekannt
--     (maskierte bzw. unvollstaendige Zeile). Eine Summe ueber nur die
--     sichtbaren Zeilen waere eine zu kleine, aber serioes aussehende Zahl.
--   * pm_payout  — bei gemischten Quellwaehrungen gibt es diesen EINEN Skalar
--     nicht; die Aufschluesselung steht in `pm_payout_by_currency`.
--
-- Deshalb wird der Zustand „Wert gibt es nicht" als NULL modelliert und NICHT
-- als 0 (Wurzel 4): eine 0 in einer Abrechnung liest sich als „nichts
-- eingenommen" bzw. „keine Provision faellig" — eine Falschaussage, die
-- niemand als Bug erkennt. Die UI rendert NULL als „—".
--
-- `default 0` faellt aus demselben Grund weg: der Default hat den fehlenden
-- Wert bisher beim INSERT still zu einer 0 gemacht.
--
-- Die uebrigen Betragsspalten (total_payout, expenses_total, owner_payout)
-- bleiben `not null`: sie sind immer berechenbar — eine leere Abrechnung hat
-- echte 0,00 Auszahlung, das ist keine fehlende Zahl, sondern eine gemessene.
-- `_compute_summary` typisiert sie entsprechend als `float` (nicht optional).

alter table public.owner_statements
    alter column total_price drop not null,
    alter column total_price drop default,
    alter column pm_payout   drop not null,
    alter column pm_payout   drop default;

comment on column public.owner_statements.total_price is
    'Gast-Bruttoeinnahmen (Snapshot, ungekuerzt fuer die Buchhaltung). NULL = '
    'nicht durchgaengig bekannt; niemals 0 als Ersatzwert. Maskierung nach '
    'Lastenheft §4.2 greift beim Ausliefern, nicht beim Speichern.';

comment on column public.owner_statements.pm_payout is
    'Auszahlung der Verwaltung (Agentur-Ertrag, Snapshot). NULL = bei '
    'gemischten Quellwaehrungen nicht als einzelner Betrag darstellbar; die '
    'Aufschluesselung fuehrt der Service je Waehrung.';

-- Kein Grant-/RLS-Teil noetig: `owner_statements` ist bereits ueber
-- 0187_harden_sensitive_grants.sql und 0337_direktpfad_sensible_tabellen_
-- schliessen.sql fuer anon/authenticated gesperrt (Wurzel 6). Diese Migration
-- aendert ausschliesslich die NULL-Barkeit zweier Betragsspalten und fasst
-- weder Policies noch Grants an.
