-- 0524 — Eigentümer-Abrechnung: Snapshot-Spalten für wiederkehrende Posten.
--
-- Anlass (Betrieb, 02.09.2026): „Jede Gebühr muss als einzelner Posten
-- aufgeschlüsselt werden auf der Abrechnung." Dazu gehört der dritte Abzugsweg
-- neben Vertrags-Pauschale und Verrechnungsposten: die DAUERVEREINBARUNG
-- (`owner_recurring_items`, 0365 — „50 DKK je Buchung"). Bis heute las nur der
-- Bericht (`owner_reporting`) diese Tabelle, die Abrechnung nicht. Die
-- Betreiberin legte denselben Betrag deshalb von Hand als Verrechnungsposten
-- an — zusätzlich zur Vertragspauschale, also doppelt (20.08.2026, zwei Posten
-- „Indflytning-gebyr" à 50 DKK auf Feriehus „Perlen").
--
-- Die Abrechnung rechnet die Posten jetzt selbst (owner_statements/zeilen.py
-- über owner_statements/wiederkehrend.py, dieselbe Regel wie im Bericht). Der
-- Summen-Snapshot einer finalisierten Rechnung braucht dafür zwei Spalten —
-- beide Richtungen EINZELN, wie 0348 es für die Verrechnungsposten eingeführt
-- hat: eine Nettozahl allein verbirgt, dass 200 Gutschrift und 50 Abzug
-- gegeneinanderstehen.
--
-- KEIN Backfill: bestehende finalisierte Belege wurden OHNE diese Posten
-- gerechnet und tragen eine fortlaufende Nummer. Ein Backfill schriebe eine
-- andere Summe in eine bereits ausgestellte Rechnung. Neue Belege füllen die
-- Spalten beim Finalisieren; der Storno-Beleg negiert sie wie jede andere
-- Betragsspalte.
--
-- RLS/Grants: unverändert. `owner_statements` ist Finanztabelle; `revoke` für
-- anon/authenticated gilt seit 0187/0337 (Wurzel 6). Diese Migration fügt nur
-- Spalten hinzu.

alter table public.owner_statements
    add column if not exists recurring_to_owner   numeric not null default 0,
    add column if not exists recurring_from_owner numeric not null default 0;

comment on column public.owner_statements.recurring_to_owner is
    'Summe der wiederkehrenden Posten (owner_recurring_items) ZUGUNSTEN des '
    'Eigentuemers im Zeitraum (Snapshot, immer positiv). Bestandteil von '
    'owner_payout. Im Storno-Beleg negiert. Kein Backfill (0524).';

comment on column public.owner_statements.recurring_from_owner is
    'Summe der wiederkehrenden Posten (owner_recurring_items) ZULASTEN des '
    'Eigentuemers im Zeitraum (Snapshot, immer positiv; abschnitt=ausgaben). '
    'Bestandteil von owner_payout. Im Storno-Beleg negiert. Kein Backfill (0524).';
