-- 0364 — Portal-Abzugssätze je Kanal (Provision + Zahlungsgebühr)
--
-- ANLASS (live geklärt mit dem Beta-Betrieb am 11.08.2026): die Auszahlung an
-- den Eigentümer braucht den Betrag, den das PORTAL einbehält. Bisher stand
-- dafür nur `reservations.channel_fee` bereit — live bei 0 von 223 Buchungen
-- gefüllt. Die Folge war eine Auszahlung, die den Portal-Anteil als Ertrag des
-- Eigentümers auswies.
--
-- WARUM ZWEI SÄTZE UND NICHT EINER: Booking.com erhebt ZWEI getrennte Abzüge —
-- 15 % Vermittlungsprovision plus 1,5 % Zahlungsgebühr (= die 16,5 %, mit denen
-- die Buchhaltung rechnet). Airbnb erhebt nur die Provision (15,5 %) und keine
-- Zahlungsgebühr. Mit einem Feld ließe sich das nicht abbilden, und ein
-- zusammengefasster Satz wäre in der Abrechnung nicht nachvollziehbar: der
-- Eigentümer sieht in seiner Portal-Abrechnung beide Posten getrennt.
--
-- WARUM DIE ZAHLUNGSGEBÜHR AN `payment_collect` HÄNGT: sie ist das Entgelt für
-- die GELDWEITERLEITUNG. Zieht das Portal das Geld ein (`payment_collect='ota'`),
-- fällt sie an; zahlt der Gast direkt an den Betrieb, leitet das Portal kein
-- Geld weiter und es gibt sie nicht. Das ist in den Echtdaten belegt: bei allen
-- 25 Buchungen mit `payment_collect='ota'` meldet das Portal seine Provision
-- (22 Airbnb, 3 Booking), bei den 51 Booking-Buchungen mit Direktzahlung ist
-- das Feld leer. Die Auswertung macht die Rechenkette, nicht die DB.
--
-- WARUM KEINE DEFAULTS: ein `default 15.0` wäre genau der erfundene Wert aus
-- Wurzel 4 — er sähe in der Maske wie eine Vereinbarung aus, die niemand
-- getroffen hat. `provision_pct` ist `not null` (ohne einen Satz hat die Zeile
-- keinen Zweck), `zahlungsgebuehr_pct` ist NULLABLE: "keine Zahlungsgebühr"
-- (Airbnb) ist ein echter Zustand und keine 0-Vereinbarung.
--
-- ZEITACHSE wie beim Abrechnungsvertrag (0343): Portale ändern ihre Sätze. Eine
-- im September erzeugte Juli-Abrechnung muss mit dem Juli-Satz rechnen, sonst
-- ergäbe dieselbe Abrechnung je Erzeugungstag eine andere Zahl. Eine Ablösung
-- ist ein NEUER Satz ab Datum X, kein Überschreiben — die Historie bleibt
-- nachvollziehbar. Halb offenes Intervall [ab, bis): der Nachfolger beginnt am
-- Endtag des Vorgängers, kein Tag gehört zu beiden.

create table if not exists public.portal_abzugssaetze (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Der Kanal, für den der Satz gilt. Klein geschrieben und ohne Leerzeichen
  -- (`booking`, `airbnb`, `expedia`) — dieselbe Schreibweise wie
  -- `reservations.channel`, damit die Rechenkette ohne Übersetzungstabelle
  -- zuordnen kann.
  kanal text not null,
  -- Optional je Objekt: ein Betrieb kann für ein einzelnes Objekt einen
  -- abweichenden Satz verhandelt haben (Booking-Zuschläge wie „Preferred"
  -- gelten pro Inserat). NULL = gilt für alle Objekte des Betriebs.
  -- Objekt schlägt Betrieb, dasselbe Vorrangprinzip wie in 0343.
  property_id uuid references public.properties(id) on delete cascade,
  gueltig_ab date not null,
  gueltig_bis date,
  provision_pct numeric not null check (provision_pct >= 0 and provision_pct <= 100),
  -- NULL = dieses Portal erhebt keine Zahlungsgebühr (Airbnb).
  zahlungsgebuehr_pct numeric check (
    zahlungsgebuehr_pct is null
    or (zahlungsgebuehr_pct >= 0 and zahlungsgebuehr_pct <= 100)
  ),
  notiz text,
  erstellt_von uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gueltig_bis is null or gueltig_bis > gueltig_ab)
);

-- Kein Zeitraum-Überlapp je (Kanal, Objekt) bzw. je (Kanal, betriebsweit).
-- Zwei Sätze für denselben Tag wären nicht auflösbar — die Rechenkette müsste
-- raten, welcher gilt. Zwei getrennte Constraints, weil `property_id is null`
-- in einem gist-Index nicht mit `=` vergleichbar ist.
create extension if not exists btree_gist;

drop index if exists portal_abzugssaetze_objekt_kein_ueberlapp;
alter table public.portal_abzugssaetze
  drop constraint if exists portal_abzugssaetze_objekt_kein_ueberlapp;
alter table public.portal_abzugssaetze
  add constraint portal_abzugssaetze_objekt_kein_ueberlapp
  exclude using gist (
    tenant_id with =, kanal with =, property_id with =,
    daterange(gueltig_ab, gueltig_bis, '[)') with &&
  ) where (property_id is not null);

alter table public.portal_abzugssaetze
  drop constraint if exists portal_abzugssaetze_betrieb_kein_ueberlapp;
alter table public.portal_abzugssaetze
  add constraint portal_abzugssaetze_betrieb_kein_ueberlapp
  exclude using gist (
    tenant_id with =, kanal with =,
    daterange(gueltig_ab, gueltig_bis, '[)') with &&
  ) where (property_id is null);

create index if not exists portal_abzugssaetze_lookup_idx
  on public.portal_abzugssaetze (tenant_id, kanal, gueltig_ab desc);

comment on table public.portal_abzugssaetze is
  'Was ein Vertriebsportal je Buchung einbehält: Provision + optionale '
  'Zahlungsgebühr, mit Zeitachse. Rückfall für Buchungen, bei denen das Portal '
  'seine Provision nicht mitmeldet (payment_collect != ota).';
comment on column public.portal_abzugssaetze.zahlungsgebuehr_pct is
  'NULL = Portal erhebt keine Zahlungsgebühr (Airbnb). Wirkt nur bei '
  'payment_collect=ota, weil sie das Entgelt für die Geldweiterleitung ist.';

-- =========================================================================
-- RLS + GRANTS (Wurzel 6) — Muster wie 0343
-- =========================================================================
-- Diese Tabelle bestimmt Geldbeträge in der Eigentümer-Abrechnung. Ein
-- eingeloggter cleaner mit dem öffentlichen anon-Key darf sie per
-- `curl /rest/v1/portal_abzugssaetze` weder lesen noch schreiben: ein
-- geänderter Satz verschiebt die Auszahlung. `enable rls` + tenant-Policy
-- allein reicht dafür NICHT — erst der GRANT-Entzug schließt den DB-Direktpfad.
alter table public.portal_abzugssaetze enable row level security;

drop policy if exists portal_abzugssaetze_tenant on public.portal_abzugssaetze;
create policy portal_abzugssaetze_tenant on public.portal_abzugssaetze
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

revoke all on public.portal_abzugssaetze from anon, authenticated;

-- Realtime-Folge, ausdrücklich festgehalten: die Tabelle kommt NICHT in die
-- Publikation `supabase_realtime`. Ohne SELECT-Grant passt keine Policy, ein
-- Abo wäre eine stumme Attrappe. Die Pflegemaske lädt über die API und
-- aktualisiert nach der eigenen Aktion — die Daten ändern sich ausschließlich
-- durch eine Handlung genau dieses Nutzers.
