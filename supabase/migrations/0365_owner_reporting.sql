-- =========================================================================
-- 0365 — Reporting für Eigentümer: Bericht → Zahlung → Teilzahlung,
--        geplante Berichte und wiederkehrende Posten
-- =========================================================================
-- ANLASS: Bis heute konnte der Betrieb je Eigentümer EINE Abrechnung erzeugen
-- (`owner_statements`, 0064). Was fehlte, ist die Ebene DARÜBER: die Auswertung
-- eines Zeitraums über eine AUSWAHL VON OBJEKTEN, aus der anschließend je
-- Empfänger eine Auszahlung entsteht. Genau so arbeitet der Markt (Lodgify
-- „Reporting für Eigentümer", Hostaway „Owner Statements", Guesty „Owner
-- Revenue Reports"): erst der Bericht über den Bestand, dann die Zahlungen
-- daraus.
--
-- WARUM ZWEI EBENEN UND NICHT EINE:
-- Ein Bericht deckt 10 Objekte ab, die 3 verschiedenen Eigentümern gehören.
-- Die Aufschlüsselungen (Mieten je Objekt, Gebühren je Art, Portal-Provisionen
-- je Kanal) sind Aussagen über den GESAMTEN Bericht — sie an einer einzelnen
-- Eigentümer-Abrechnung zu führen hieße, sie dreimal zu erzeugen und dreimal
-- unterschiedlich zu runden. Die Auszahlung dagegen ist immer die Sache GENAU
-- EINES Empfängers: sie wird bezahlt, teilbezahlt, in Rechnung gestellt.
--
-- WAS BERECHNET UND WAS GESPEICHERT WIRD (bewusste Trennung):
--   * Der BERICHT speichert nur seinen SCOPE (Zeitraum, Objekte, Basis,
--     Währung). Seine Aufschlüsselungen werden bei jedem Abruf frisch aus
--     `reservations` gerechnet — eine nachgetragene Buchung im Zeitraum muss
--     sich zeigen, sonst wäre der Bericht stumm veraltet.
--   * Die ZAHLUNG speichert ihre Posten als SNAPSHOT (`owner_report_payment_items`).
--     Sie ist eine Forderung: einmal erzeugt, darf sie sich nicht mehr ändern,
--     nur weil jemand später eine Gebühr am Objekt korrigiert. Genau dieselbe
--     Trennung wie zwischen Vorschau und finalisierter Rechnung in 0064.
--
-- DIE FÜNF ABSCHNITTE EINER ZAHLUNG sind keine Erfindung, sondern die
-- Gliederung, die der Markt führt und die der Eigentümer erwartet:
--   unterkunftspreis · gebuehren · steuern · ausgaben · andere
-- „ausgaben" ist der einzige Abschnitt mit negativem Vorzeichen (er MINDERT
-- die Auszahlung); alle anderen sind positiv. Ohne diese Regel wäre aus einem
-- Vorzeichenfehler eine Zahlung statt eines Abzugs geworden.
--
-- KEINE ERFUNDENEN WÄHRUNGEN (Wurzel 4): `currency` ist überall `not null`
-- OHNE Default. Ein `default 'EUR'` sähe in der Maske aus wie eine Entscheidung
-- des Betriebs; bei einem dänischen Bestand wäre jede Zahl um Faktor 7,45
-- falsch. Wer eine Zeile schreibt, muss die Währung nennen.

-- =========================================================================
-- (A) Geplante Berichte — zuerst, weil der Bericht auf sie verweist
-- =========================================================================
create table if not exists public.owner_report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  -- Lodgify-Verhalten „include date in name": der erzeugte Bericht heißt dann
  -- „2026-07 <name>". Ein Schalter, kein Namensmuster im Code — sonst könnte
  -- der Betrieb ihn nicht abwählen.
  name_mit_datum boolean not null default true,
  aktiv boolean not null default true,
  -- Rhythmus des LAUFS. `woche` ist kein theoretischer Fall: Agenturen mit
  -- Kurzzeitvermietung rechnen wöchentlich ab.
  rhythmus text not null check (rhythmus in ('woche', 'monat', 'quartal', 'jahr')),
  -- An welchem Tag der Periode gelaufen wird. `erste`/`letzte` statt einer Zahl,
  -- weil „der 31." in vier Monaten nicht existiert und ein stiller Rückfall auf
  -- den 30. eine andere Vereinbarung wäre.
  am_tag text not null default 'erste' check (am_tag in ('erste', 'letzte')),
  -- Welchen Zeitraum der Bericht auswertet: die eben abgeschlossene Periode
  -- (Normalfall) oder die laufende (Zwischenstand).
  zeitraum text not null default 'vergangener'
    check (zeitraum in ('vergangener', 'laufender')),
  -- Berichtswährung. Ohne Default (Wurzel 4).
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Welches Datum der Buchung den Zeitraum entscheidet. Dieselben Werte wie
  -- `owner_statements.basis`, plus `booked` — der Buchungszeitpunkt aus der
  -- QUELLE (Wurzel 5b), nicht unser Eingang.
  basis text not null default 'check_in'
    check (basis in ('check_in', 'check_out', 'booked')),
  -- Wann der Lauf zuletzt einen Bericht erzeugt hat. Der Cron liest das, um
  -- nicht zweimal für dieselbe Periode zu erzeugen (Wurzel 2: Retries sind real).
  zuletzt_erzeugt_fuer date,
  erstellt_von uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_report_schedules_tenant_idx
  on public.owner_report_schedules (tenant_id, aktiv);

-- Objekte des Plans. Eigene Tabelle statt uuid[]: nur so kann ein gelöschtes
-- Objekt per FK automatisch aus allen Plänen verschwinden, statt als tote ID
-- stehenzubleiben und den Lauf jedes Mal auf ein Nichts zeigen zu lassen.
create table if not exists public.owner_report_schedule_properties (
  schedule_id uuid not null
    references public.owner_report_schedules(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  primary key (schedule_id, property_id)
);

-- Empfänger des Plans (= Eigentümer). Ohne mindestens einen Empfänger erzeugt
-- der Lauf zwar einen Bericht, aber keine Zahlung — das ist ein gültiger
-- Zustand (reiner Auswertungsbericht) und deshalb kein NOT-NULL-Zwang.
create table if not exists public.owner_report_schedule_recipients (
  schedule_id uuid not null
    references public.owner_report_schedules(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  primary key (schedule_id, owner_id)
);

-- =========================================================================
-- (B) Bericht
-- =========================================================================
create table if not exists public.owner_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  period_from date not null,
  period_to date not null,
  basis text not null default 'check_in'
    check (basis in ('check_in', 'check_out', 'booked')),
  -- Welche Buchungsstatus zählen. Leer = alle. Als Array, weil die Auswahl
  -- Teil des Berichts-Scopes ist und sich sonst zwischen zwei Abrufen
  -- unbemerkt ändern könnte.
  reservation_statuses text[] not null default '{}',
  -- Kam der Bericht aus einem Plan? Lodgify zeigt das als Spalte
  -- „Automatisch generiert JA/NEIN"; sie entscheidet, ob ein Mensch ihn
  -- angelegt hat und ob er beim nächsten Lauf ersetzt werden darf.
  schedule_id uuid references public.owner_report_schedules(id) on delete set null,
  erstellt_von uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Halb offen wäre hier falsch: der Bericht „1.–31. Juli" schließt den 31.
  -- ein, so steht es auf dem Papier, das der Eigentümer bekommt.
  check (period_to >= period_from)
);

create index if not exists owner_reports_tenant_idx
  on public.owner_reports (tenant_id, period_from desc);
-- Ein Plan erzeugt je Periode höchstens EINEN Bericht. Der DB-Backstop gegen
-- die doppelte Cron-Zustellung (Wurzel 2) — ein Statusfeld allein reicht nicht,
-- weil zwei gleichzeitige Läufe beide „noch nicht erzeugt" lesen würden.
create unique index if not exists owner_reports_plan_periode_uniq
  on public.owner_reports (schedule_id, period_from, period_to)
  where schedule_id is not null;

create table if not exists public.owner_report_properties (
  report_id uuid not null references public.owner_reports(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  primary key (report_id, property_id)
);

-- =========================================================================
-- (C) Zahlung je Empfänger
-- =========================================================================
create table if not exists public.owner_report_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_id uuid not null references public.owner_reports(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Die fünf Abschnittssummen als SNAPSHOT. Sie stehen hier und nicht nur als
  -- Summe über `owner_report_payment_items`, weil die Zahlung ihre eigene
  -- Wahrheit ist: ein später gelöschter Posten darf die ausgewiesene Forderung
  -- nicht rückwirkend ändern.
  summe_unterkunftspreis numeric not null default 0,
  summe_gebuehren numeric not null default 0,
  summe_steuern numeric not null default 0,
  -- Negativ oder 0 — Ausgaben MINDERN die Zahlung. Der Check verhindert, dass
  -- ein Vorzeichenfehler aus einem Abzug eine Gutschrift macht.
  summe_ausgaben numeric not null default 0 check (summe_ausgaben <= 0),
  summe_andere numeric not null default 0,
  -- Der Gesamtbetrag wird vom Server gesetzt (Summe der fünf Abschnitte) und
  -- gespeichert, damit Listen ihn nicht je Zeile nachrechnen müssen.
  betrag numeric not null,
  -- Bezugsdatum der Zahlung für die Statistik („Im Laufe der Zeit gezahltes
  -- Geld"). Der Tag, an dem sie als bezahlt markiert wurde; solange offen: NULL.
  bezahlt_am date,
  -- Freitext des Betriebs (Referenz der Überweisung o. Ä.).
  notiz text,
  -- Belegbezug: die Rechnung, die aus dieser Zahlung erzeugt wurde. Lodgify
  -- zeigt dafür die Spalte „Hat Rechnung? JA/NEIN". Verweis statt boolean,
  -- damit die Liste direkt zum Beleg springen kann.
  statement_id uuid references public.owner_statements(id) on delete set null,
  erstellt_von uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Je Bericht und Empfänger genau EINE Zahlung. Ohne diesen Backstop erzeugt
-- ein Doppelklick auf „Zahlung erstellen" zwei Forderungen über denselben
-- Betrag (Wurzel 2) — und die zweite fällt niemandem auf, weil beide plausibel
-- aussehen.
create unique index if not exists owner_report_payments_uniq
  on public.owner_report_payments (report_id, owner_id);
create index if not exists owner_report_payments_tenant_idx
  on public.owner_report_payments (tenant_id, created_at desc);
create index if not exists owner_report_payments_owner_idx
  on public.owner_report_payments (tenant_id, owner_id);

create table if not exists public.owner_report_payment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid not null
    references public.owner_report_payments(id) on delete cascade,
  abschnitt text not null check (
    abschnitt in ('unterkunftspreis', 'gebuehren', 'steuern', 'ausgaben', 'andere')
  ),
  label text not null check (length(btrim(label)) > 0),
  -- Herkunft des Postens, soweit vorhanden. `on delete set null`: eine
  -- gelöschte Reservierung darf den Beleg nicht mitreißen — der Betrag wurde
  -- gefordert, das bleibt wahr.
  reservation_id uuid references public.reservations(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  betrag numeric not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Reihenfolge innerhalb des Abschnitts, damit die Anzeige stabil ist. Ohne
  -- sie wechselte die Reihenfolge je Abfrage und der Eigentümer sähe seine
  -- Abrechnung bei jedem Öffnen anders sortiert.
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists owner_report_payment_items_payment_idx
  on public.owner_report_payment_items (payment_id, abschnitt, position);

-- Teilzahlungen. Lodgify erlaubt „Teilzahlung hinzufügen/ansehen" und zeigt in
-- der Liste einen „Bezahlter Prozentsatz" — der ist die Summe der Teile durch
-- den Gesamtbetrag und wird NICHT gespeichert, sondern gerechnet: ein
-- gespeicherter Prozentsatz liefe beim Nachtragen eines Teils auseinander.
create table if not exists public.owner_report_payment_parts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid not null
    references public.owner_report_payments(id) on delete cascade,
  betrag numeric not null check (betrag > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  bezahlt_am date not null,
  notiz text,
  erstellt_von uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists owner_report_payment_parts_payment_idx
  on public.owner_report_payment_parts (payment_id, bezahlt_am);

-- =========================================================================
-- (D) Wiederkehrende Posten je Empfänger
-- =========================================================================
-- Sie unterscheiden sich fachlich von `owner_expenses` (0064/0344): ein
-- Verrechnungsposten ist ein EINZELFALL mit Datum und Beleg („Glühbirnen,
-- 12.07."). Ein wiederkehrender Posten ist eine DAUERVEREINBARUNG, die bei
-- jeder Buchung bzw. je Zeitraum automatisch anfällt („Willkommensgebühr 50
-- je Buchung"). Beides in eine Tabelle zu legen hieße, die Wiederholung als
-- Datumsfeld zu simulieren und bei jeder Abrechnung Kopien anzulegen.
create table if not exists public.owner_recurring_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  -- In welchen Abschnitt der Zahlung der Posten fällt. `steuern` fehlt
  -- absichtlich: eine Steuer ist nie eine Dauervereinbarung zwischen Betrieb
  -- und Eigentümer, sondern folgt dem Steuerrecht des Objekts
  -- (`property_taxes`). Sie hier zuzulassen erzeugte eine zweite, konkurrierende
  -- Steuerquelle.
  abschnitt text not null check (
    abschnitt in ('unterkunftspreis', 'gebuehren', 'ausgaben', 'andere')
  ),
  -- Worauf sich der Betrag bezieht.
  modus text not null check (modus in ('je_buchung', 'je_nacht', 'je_zeitraum')),
  -- Immer POSITIV. Ob er zu- oder abschlägt, entscheidet `abschnitt`
  -- (`ausgaben` = Abzug). Ein Vorzeichen im Betrag wäre die zweite, stille
  -- Achse für dieselbe Aussage — und ginge beim Eintippen verloren
  -- (derselbe Fehler wie bei `owner_expenses.direction`, 0344).
  betrag numeric not null check (betrag > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- NULL = gilt für alle Objekte dieses Eigentümers.
  property_id uuid references public.properties(id) on delete cascade,
  aktiv boolean not null default true,
  notiz text,
  erstellt_von uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_recurring_items_owner_idx
  on public.owner_recurring_items (tenant_id, owner_id, aktiv);

-- =========================================================================
-- Kommentare
-- =========================================================================
comment on table public.owner_reports is
  'Bericht für Eigentümer: gespeicherter SCOPE (Zeitraum, Objekte, Basis, '
  'Währung). Die Aufschlüsselungen werden bei jedem Abruf frisch gerechnet — '
  'nur die daraus erzeugten Zahlungen sind Snapshots.';
comment on table public.owner_report_payments is
  'Auszahlung an EINEN Empfänger aus einem Bericht. Fünf Abschnittssummen als '
  'Snapshot; Ausgaben sind negativ (Abzug).';
comment on column public.owner_report_payments.statement_id is
  'Die aus dieser Zahlung erzeugte Rechnung (owner_statements). NULL = noch '
  'keine Rechnung — Lodgify-Spalte „Hat Rechnung?".';
comment on table public.owner_report_payment_parts is
  'Teilzahlungen. Der „bezahlte Prozentsatz" wird daraus gerechnet, nie '
  'gespeichert — sonst liefe er beim Nachtragen eines Teils auseinander.';
comment on table public.owner_recurring_items is
  'Dauervereinbarung je Empfänger (z. B. Willkommensgebühr je Buchung). '
  'Abgegrenzt von owner_expenses: das sind Einzelfälle mit Datum und Beleg.';

-- =========================================================================
-- RLS + GRANTS (Wurzel 6) — Muster wie 0343/0364
-- =========================================================================
-- Jede dieser Tabellen bestimmt Geldbeträge. Ein eingeloggter cleaner mit dem
-- öffentlichen anon-Key darf sie per `curl /rest/v1/<tabelle>` weder lesen noch
-- schreiben. `enable rls` + tenant-Policy allein reicht dafür NICHT — erst der
-- GRANT-Entzug schließt den DB-Direktpfad.
--
-- Die beiden n:m-Tabellen ohne eigene `tenant_id` (owner_report_properties,
-- owner_report_schedule_properties, owner_report_schedule_recipients) tragen
-- die Mandantenprüfung über ihren Elternsatz: eine eigene tenant_id wäre eine
-- zweite Wahrheit, die per UPDATE von der des Berichts abweichen könnte.
do $$
declare
  t text;
begin
  foreach t in array array[
    'owner_reports',
    'owner_report_payments',
    'owner_report_payment_items',
    'owner_report_payment_parts',
    'owner_report_schedules',
    'owner_recurring_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant', t);
    execute format(
      'create policy %I on public.%I for all '
      'using (tenant_id = public.current_tenant_id()) '
      'with check (tenant_id = public.current_tenant_id())',
      t || '_tenant', t
    );
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

alter table public.owner_report_properties enable row level security;
drop policy if exists owner_report_properties_tenant on public.owner_report_properties;
create policy owner_report_properties_tenant on public.owner_report_properties
  for all
  using (
    exists (
      select 1 from public.owner_reports r
      where r.id = report_id and r.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.owner_reports r
      where r.id = report_id and r.tenant_id = public.current_tenant_id()
    )
  );
revoke all on public.owner_report_properties from anon, authenticated;

alter table public.owner_report_schedule_properties enable row level security;
drop policy if exists owner_report_schedule_properties_tenant
  on public.owner_report_schedule_properties;
create policy owner_report_schedule_properties_tenant
  on public.owner_report_schedule_properties
  for all
  using (
    exists (
      select 1 from public.owner_report_schedules s
      where s.id = schedule_id and s.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.owner_report_schedules s
      where s.id = schedule_id and s.tenant_id = public.current_tenant_id()
    )
  );
revoke all on public.owner_report_schedule_properties from anon, authenticated;

alter table public.owner_report_schedule_recipients enable row level security;
drop policy if exists owner_report_schedule_recipients_tenant
  on public.owner_report_schedule_recipients;
create policy owner_report_schedule_recipients_tenant
  on public.owner_report_schedule_recipients
  for all
  using (
    exists (
      select 1 from public.owner_report_schedules s
      where s.id = schedule_id and s.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.owner_report_schedules s
      where s.id = schedule_id and s.tenant_id = public.current_tenant_id()
    )
  );
revoke all on public.owner_report_schedule_recipients from anon, authenticated;

-- Realtime-Folge, ausdrücklich festgehalten: KEINE dieser Tabellen kommt in die
-- Publikation `supabase_realtime`. Ohne SELECT-Grant passt keine Policy, ein Abo
-- wäre eine stumme Attrappe (dieselbe Lage wie bei owner_statements/0337). Die
-- Masken laden über die API und aktualisieren nach der eigenen Aktion; sie
-- ändern sich ausschließlich durch eine Handlung genau dieses Nutzers oder
-- durch den nächtlichen Plan-Lauf, der ohnehin kein Abo bedienen würde.
