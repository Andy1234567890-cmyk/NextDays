-- 0348_owner_statements_richtungssummen.sql
-- Die beiden Richtungssummen fehlten im Snapshot — finalisierte Abrechnungen
-- meldeten sie als 0.
--
-- BEFUND: `owner_statements` fror bisher nur `expenses_total` ein (die
-- NETTO-Wirkung Σzugunsten − Σzulasten). Die beiden Richtungen einzeln gab es
-- als Spalte nicht. Der Lesepfad fuer nicht-Entwuerfe (`service.get`, Zweig
-- `status != 'draft'`) baut die Summary aus genau dieser Zeile neu auf; was die
-- Zeile nicht traegt, fiel auf den Pydantic-Default `0.0` zurueck.
--
-- Damit meldete ausgerechnet die FINALISIERTE Abrechnung — das Dokument, das
-- der Eigentuemer wirklich bekommt — `expenses_to_owner = 0` und
-- `expenses_from_owner = 0`, obwohl Verrechnungsposten in beiden Richtungen
-- vorlagen. Eine gelieferte 0 laesst „es gab keine" und „das Feld wurde nie
-- gefuellt" nicht unterscheiden (Wurzel 4).
--
-- WARUM SPALTEN und nicht aus den Posten abgeleitet: `owner_expenses`-Zeilen
-- bleiben nach dem Finalisieren aenderbar (`update_expense`/`delete_expense`
-- sperren nicht auf den Statement-Status; `_refresh_summary` ueberspringt dann
-- nur den Schreibvorgang). Eine live aus den Posten gerechnete Richtungssumme
-- wuerde nach so einer Aenderung dem eingefrorenen `expenses_total` derselben
-- Rechnung widersprechen. Die Netto-Zahl ist ein Snapshot; ihre beiden
-- Bestandteile muessen es genauso sein — sonst ist die Rechnung in sich
-- unstimmig. Zusaetzlich braucht `cancel()` die Werte aus der ZEILE, um sie
-- negiert in den Storno-Beleg zu uebernehmen.
--
-- `not null default 0` wie `expenses_total`: diese drei Summen sind IMMER
-- berechenbar (keine Posten = echte, gemessene 0,00). Das unterscheidet sie von
-- `total_price`/`pm_payout`, die 0346 aus gutem Grund nullable gemacht hat —
-- dort gibt es den Wert fachlich nicht. Der Default deckt ausschliesslich den
-- Altbestand ab; jeder Schreibpfad im Service setzt beide Spalten explizit.

alter table public.owner_statements
    add column if not exists expenses_to_owner   numeric not null default 0,
    add column if not exists expenses_from_owner numeric not null default 0;

comment on column public.owner_statements.expenses_to_owner is
    'Summe der Verrechnungsposten ZUGUNSTEN des Eigentuemers (Snapshot, immer '
    'positiv). Bestandteil von expenses_total = expenses_to_owner - '
    'expenses_from_owner. Im Storno-Beleg negiert.';

comment on column public.owner_statements.expenses_from_owner is
    'Summe der Verrechnungsposten ZULASTEN des Eigentuemers (Snapshot, immer '
    'positiv). Bestandteil von expenses_total = expenses_to_owner - '
    'expenses_from_owner. Im Storno-Beleg negiert.';

-- Altbestand: fuer bereits finalisierte/stornierte Belege lassen sich die
-- beiden Richtungen aus den daran gebundenen Posten rekonstruieren. Das ist
-- keine Schaetzung, sondern dieselbe Ableitung, die der Service fuer den
-- Entwurfspfad fahrt: Richtung aus `direction`, Betrag positiv (0344er
-- Check-Constraint). Entwuerfe brauchen es nicht — sie rechnen ohnehin live.
update public.owner_statements s
   set expenses_to_owner = coalesce(agg.zugunsten, 0),
       expenses_from_owner = coalesce(agg.zulasten, 0)
  from (
        select e.statement_id,
               sum(e.amount) filter (where e.direction = 'to_owner')   as zugunsten,
               sum(e.amount) filter (where e.direction = 'from_owner') as zulasten
          from public.owner_expenses e
         where e.statement_id is not null
         group by e.statement_id
       ) agg
 where agg.statement_id = s.id;

-- Kein Grant-/RLS-Teil noetig: `owner_statements` ist ueber
-- 0187_harden_sensitive_grants.sql und 0337_direktpfad_sensible_tabellen_
-- schliessen.sql fuer anon/authenticated gesperrt (Wurzel 6). Diese Migration
-- fuegt ausschliesslich zwei Betragsspalten hinzu und fasst weder Policies noch
-- Grants an.
