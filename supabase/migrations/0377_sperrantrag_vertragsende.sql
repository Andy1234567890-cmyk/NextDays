-- 0377 — Ein Sperrantrag kann eine VERTRAGSKÜNDIGUNG sein.
--
-- WARUM:
-- Live vorgefunden (12.08.2026): Der Eigentümer von „Feriehus Kornblomst"
-- beantragte 2027-01-01 bis 2027-12-31 mit der Begründung „Vi er ikke
-- interesseret i udlejning 2027" — er wollte nicht ein Jahr sperren, sondern
-- den Vermarktungsvertrag nicht fortsetzen. Das System kannte dafür kein Feld:
-- die Agentur musste den dänischen Freitext lesen, die Absicht erkennen und
-- `properties.contract_end_date` von Hand nachtragen. Genau das ist der
-- Schritt, der vergessen wird — danach steht ein „genehmigter" Antrag, der ein
-- Jahr sperrt, während der Vertrag formal weiterläuft (mit Provision,
-- Abrechnung und Portal-Distribution).
--
-- ZWEI FELDER, WEIL ES ZWEI AUSSAGEN SIND:
--   `ist_kuendigung`      — was der EIGENTÜMER erklärt hat (er wählt es beim
--                           Stellen). Seine Willenserklärung, nicht unsere
--                           Deutung.
--   `als_kuendigung_gewertet` — was die AGENTUR daraus gemacht hat. Nötig für
--                           den BESTAND: Kornblomst hat `ist_kuendigung=false`
--                           (das Feld gab es beim Stellen nicht), und die
--                           Agentur muss den Antrag trotzdem als Kündigung
--                           akzeptieren können, OHNE beim Eigentümer eine
--                           zweite Anfrage auszulösen.
-- Ein einziges Feld für beides wäre eine Fälschung: es stünde hinterher
-- „der Eigentümer hat gekündigt", wo die Agentur ausgelegt hat.
--
-- `vertragsende_gesetzt_auf` hält fest, WELCHES Datum daraus wurde. Ohne diese
-- Spur ließe sich später nicht mehr sagen, ob das Enddatum am Objekt aus diesem
-- Antrag stammt oder von Hand gesetzt wurde — und der Widerruf wüsste nicht,
-- was er zurückzunehmen hätte (Wurzel 1).

alter table public.block_requests
  add column if not exists ist_kuendigung boolean not null default false,
  add column if not exists als_kuendigung_gewertet boolean not null default false,
  add column if not exists vertragsende_gesetzt_auf date;

comment on column public.block_requests.ist_kuendigung is
  'Der EIGENTÜMER hat beim Stellen erklärt, den Vertrag beenden zu wollen '
  '(eigenes Feld im Portal-Formular). Seine Willenserklärung.';

comment on column public.block_requests.als_kuendigung_gewertet is
  'Die AGENTUR hat den Antrag beim Genehmigen als Vertragskündigung gewertet — '
  'für Altbestand ohne ist_kuendigung, ohne den Eigentümer erneut zu fragen.';

comment on column public.block_requests.vertragsende_gesetzt_auf is
  'Das properties.contract_end_date, das diese Genehmigung gesetzt hat. Der '
  'Anker für den Widerruf (Wurzel 1) und die Spur, woher das Enddatum kommt.';

-- Ein Datum darf nur dastehen, wenn der Antrag auch als Kündigung behandelt
-- wurde — sonst behauptete die Zeile ein Vertragsende, das aus ihr nicht
-- folgt (fail-closed, Wurzel 5).
alter table public.block_requests
  drop constraint if exists block_requests_kuendigung_datum;
alter table public.block_requests
  add constraint block_requests_kuendigung_datum check (
    vertragsende_gesetzt_auf is null
    or ist_kuendigung
    or als_kuendigung_gewertet
  );

-- Der EXCLUDE-Constraint (0333) neu, jetzt OHNE die Kündigungen.
--
-- WARUM: Eine genehmigte Kündigung schreibt KEINE Nächte in `availability` —
-- das tut `vertragsende_durchsetzen` über `source='contract_end'`. Sie ist also
-- keine Sperrung im Sinne dieses Constraints und darf neben einer echten
-- Eigennutzungs-Sperre desselben Zeitraums stehen: „der Vertrag endet zum
-- 01.01.2027" und „im März 2027 wohne ich selbst dort" schließen sich nicht
-- aus. Ohne diese Ausnahme hätte die Kündigung den späteren, fachlich richtigen
-- Antrag mit `23P01` blockiert.
--
-- Für Sperrungen bleibt die Regel unverändert scharf: zwei genehmigte Anträge
-- über denselben Zeitraum und dieselbe Einheit sind weiterhin unmöglich.
--
-- Reihenfolge: der Constraint MUSS zuerst fallen (sein Index gehört ihm, ein
-- `drop index` darauf lehnt Postgres ab).
alter table public.block_requests
  drop constraint if exists block_requests_kein_ueberlapp;

alter table public.block_requests
  add constraint block_requests_kein_ueberlapp
  exclude using gist (
    property_id with =,
    coalesce(unit_id, property_id) with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (
    status = 'approved'
    and not ist_kuendigung
    and not als_kuendigung_gewertet
  );

-- Genehmigte Kündigungen je Objekt schnell finden (die Objektkartei zeigt sie,
-- und der Widerruf sucht darüber).
create index if not exists block_requests_kuendigung_idx
  on public.block_requests (property_id)
  where status = 'approved'
    and (ist_kuendigung or als_kuendigung_gewertet);
