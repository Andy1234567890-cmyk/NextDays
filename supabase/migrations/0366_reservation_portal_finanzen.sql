-- 0366 — Die Portal-Zerlegung JE BUCHUNG festhalten statt sie je Ansicht neu
-- aus dem OTA-Payload zu rechnen.
--
-- ANLASS (zwei echte Rechenfehler am selben Tag, 11.08.2026): das Feld
-- `reservations.total_amount` bedeutet je Portal etwas VÖLLIG anderes, und
-- nirgends stand, was. Beide Fehler sahen plausibel aus und wären in keiner
-- Summenprüfung aufgefallen:
--
--   * Airbnb schreibt dort `payout_amount` — die Auszahlung NACH Abzug der
--     15,5 % Portal-Provision. Der Code las ihn als Übernachtungspreis und zog
--     die Provision damit ein ZWEITES Mal ab. Symptom: der gemeldete Abzug
--     entsprach scheinbar 12,34 % bis 17,02 % je Buchung — bei tatsächlich
--     konstant vereinbarten 15,50 %.
--   * Booking.com schreibt dort den GASTPREIS inklusive Gebühren. Der Code
--     addierte die Objekt-Gebühren obendrauf und zählte sie damit doppelt (bei
--     einer Buchung über 9 Nächte 1.300 DKK zu viel).
--
-- Nach der Korrektur ergeben ALLE 26 Buchungen mit gemeldeter Provision exakt
-- den vereinbarten Satz: 22/22 Airbnb = 15,50 %, 4/4 Booking = 15,00 %.
--
-- WARUM DAS IN DIE DB GEHÖRT UND NICHT IN EINE LAUFZEITRECHNUNG:
--   1. EINE Wahrheit. Drei Ansichten (Eigentümer-Kalender, Einnahmen-Übersicht,
--      Abrechnung) leiteten dieselben Zahlen unabhängig voneinander aus einem
--      JSON-Blob ab. Genau dort entstehen zwei verschiedene Beträge für
--      dasselbe Geld.
--   2. NACHVOLLZIEHBARKEIT. Der Eigentümer fragt „wie kommt die Zahl
--      zustande". Mit gespeicherten Posten ist das beantwortbar, mit einer
--      Rechnung über einen Blob nicht.
--   3. HISTORISCHE STABILITÄT. Ändert der Betrieb morgen die Reinigungsgebühr
--      am Objekt, darf sich die Abrechnung von letztem Juli nicht rückwirkend
--      ändern. Bei Laufzeitrechnung aus Stammdaten passiert genau das.
--   4. PRÜFBARKEIT. Ein abweichender Satz ist als Zeile sofort auffindbar; in
--      einer Laufzeitrechnung war er unsichtbar, bis jemand explizit danach
--      suchte.
--   Branchenüblich: Hostaway und Guesty führen Finanzzeilen je Buchung,
--   Lodgify eine Buchungs-Finanzzeile — niemand rechnet das je Seitenaufruf neu.
--
-- WAS HIER *NICHT* GESPEICHERT WIRD, UND WARUM (Entscheidung des Betriebs):
-- ausschliesslich der PORTAL-Teil — was das Portal gemeldet oder einbehalten
-- hat. Das ist eine Tatsache und ändert sich nie mehr.
-- Die VERWALTUNGSPROVISION (Anteil des Betriebs) steht ABSICHTLICH nicht hier:
-- sie hängt am Abrechnungsvertrag (0343), und ein Vertrag wird korrigiert.
-- Gespeichert müsste jede Korrektur einen Nachrechnungs-Job über alle
-- betroffenen Buchungen auslösen — vergisst er eine, zeigt die Abrechnung
-- dauerhaft eine veraltete Zahl, ohne dass es auffällt. Als Laufzeitrechnung
-- aus dem Vertrag gilt eine Korrektur sofort überall. Die Trennlinie ist
-- deshalb: Tatsache = gespeichert, Vereinbarung = gerechnet.

create table if not exists public.reservation_portal_finanzen (
  reservation_id uuid primary key
    references public.reservations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Der REINE Übernachtungsbetrag ohne Gebühren und ohne Extras. Bei Airbnb
  -- `base_price + extra_guest_fee`, bei Booking die Summe aus `rooms[].days`.
  -- NICHT `reservations.total_amount` — siehe Anlass oben.
  uebernachtung numeric not null check (uebernachtung >= 0),

  -- Der Gastpreis: Übernachtung + Gebühren (+ Extras werden separat geführt).
  -- Die Bezugsgröße, auf die die Portale nachweislich ihre Provision rechnen.
  brutto numeric not null check (brutto >= 0),

  -- Was das Portal einbehält. `provision` ist der GEMELDETE Betrag, wo das
  -- Portal ihn liefert (`payment_collect='ota'`), sonst der aus dem hinterlegten
  -- Satz (0364) errechnete. `provision_gemeldet` hält fest, welches von beidem
  -- es war: eine gemeldete Provision ist ein Beleg, eine errechnete eine
  -- Rekonstruktion. Ohne diese Unterscheidung ließe sich später nicht sagen,
  -- welchen Zahlen man trauen kann.
  provision numeric not null check (provision >= 0),
  provision_gemeldet boolean not null,
  zahlungsgebuehr numeric not null default 0 check (zahlungsgebuehr >= 0),

  -- Woher die Gebührenposten kommen:
  --   'ota'        — aus der Preisaufstellung des Portals. So hat der Gast
  --                  wirklich gezahlt.
  --   'stammdaten' — aus den Objekt-Gebühren, weil der Payload keine
  --                  Aufstellung trägt (die 51 Booking-Altimporte). Das ist
  --                  eine begründete SCHÄTZUNG und wird als solche
  --                  gekennzeichnet, damit sie in der Abrechnung nicht wie ein
  --                  Portal-Beleg aussieht (Wurzel 5b: eine plausible Zahl
  --                  ohne Herkunftsangabe ist eine Falschaussage, die niemand
  --                  als Bug erkennt).
  quelle text not null check (quelle in ('ota', 'stammdaten')),

  -- Die Währung der Buchung. Steht MIT an der Zeile und wird nicht vom Objekt
  -- abgeleitet: das Objekt kann seine Währung wechseln, die Buchung nicht
  -- (Wurzel 4 — kein `|| 'EUR'`).
  currency text not null check (currency ~ '^[A-Z]{3}$'),

  berechnet_am timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Die Zerlegung muss aufgehen: Übernachtung + Gebühren = Brutto. Die Summe
  -- der Gebührenposten steht in der Kindtabelle und ist hier nicht prüfbar —
  -- prüfbar ist aber, dass das Brutto nicht KLEINER als die Übernachtung ist.
  -- Ein Verstoß wäre genau der Airbnb-Fehler von oben (Netto-Payout als
  -- Übernachtung gelesen, Gebühren addiert), diesmal von der DB abgewiesen.
  check (brutto >= uebernachtung),
  -- Der Portal-Abzug kann den Gastpreis nicht übersteigen. Er tat es in keiner
  -- der 26 Live-Buchungen; hier steht der Riegel, damit ein künftiger
  -- Rechenfehler nicht als negative Auszahlung durchläuft.
  check (provision + zahlungsgebuehr <= brutto)
);

-- Die Gebührenposten EINZELN, nicht als Summe: die Abrechnung weist sie dem
-- Eigentümer getrennt aus („Reinigung 1.075,00 / Resort 225,00"), und die
-- Zuordnung (wem gehört sie, ist sie provisionspflichtig) wirkt je Art. Eine
-- gespeicherte Gesamtsumme ließe sich nachträglich nicht mehr aufteilen.
create table if not exists public.reservation_portal_gebuehren (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null
    references public.reservation_portal_finanzen(reservation_id)
    on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Unsere Gebührenart (`fee_classification.fee_type`): 'cleaning_fee',
  -- 'resort', 'pet_fee', …
  art text not null,
  betrag numeric not null check (betrag >= 0),
  -- Der Originaltext des Portals, wo es einen liefert (Booking meldet die Art
  -- NUR als freien, sprachabhängigen Text wie „Reinigungsgebühr"). Aufbewahrt,
  -- weil bei einer unbekannten Art genau dieser Text die Frage beantwortet, was
  -- der Betrieb zuordnen muss.
  ota_bezeichnung text,
  created_at timestamptz not null default now(),
  -- Eine Art höchstens einmal je Buchung: zwei Zeilen 'cleaning_fee' wären
  -- entweder ein doppelter Schreibvorgang (Wurzel 2) oder zwei verschiedene
  -- Gebühren mit derselben Art — beides muss auffallen statt sich zu summieren.
  unique (reservation_id, art)
);

create index if not exists reservation_portal_finanzen_tenant_idx
  on public.reservation_portal_finanzen (tenant_id, berechnet_am desc);
create index if not exists reservation_portal_gebuehren_res_idx
  on public.reservation_portal_gebuehren (reservation_id);

comment on table public.reservation_portal_finanzen is
  'Die Portal-Zerlegung einer Buchung als TATSACHE festgehalten: Übernachtung, '
  'Gastpreis, Portal-Provision, Zahlungsgebühr. Die Verwaltungsprovision steht '
  'absichtlich NICHT hier — sie hängt am Abrechnungsvertrag (0343) und bleibt '
  'Laufzeitrechnung, damit eine Vertragskorrektur sofort überall gilt.';
comment on column public.reservation_portal_finanzen.uebernachtung is
  'Reiner Übernachtungsbetrag OHNE Gebühren. Bei Airbnb base_price + '
  'extra_guest_fee — NICHT total_amount, das dort der Netto-Payout nach '
  'Portal-Provision ist.';
comment on column public.reservation_portal_finanzen.quelle is
  'ota = aus der Preisaufstellung des Portals (so hat der Gast gezahlt). '
  'stammdaten = aus den Objekt-Gebühren geschätzt, weil der Payload keine '
  'Aufstellung trägt (Altimporte).';
comment on column public.reservation_portal_finanzen.provision_gemeldet is
  'true = Betrag vom Portal gemeldet (Beleg). false = aus dem hinterlegten '
  'Satz (0364) errechnet (Rekonstruktion).';

-- =========================================================================
-- RLS + GRANTS (Wurzel 6)
-- =========================================================================
-- Finanzdaten je Buchung. Ein eingeloggter cleaner mit dem öffentlichen
-- anon-Key darf sie per `curl /rest/v1/reservation_portal_finanzen` weder lesen
-- (§4.3: kein Finanzeinblick) noch schreiben (ein geänderter Betrag verschiebt
-- die Auszahlung). `enable rls` + tenant-Policy allein reicht dafür NICHT —
-- erst der GRANT-Entzug schließt den DB-Direktpfad.
alter table public.reservation_portal_finanzen enable row level security;
alter table public.reservation_portal_gebuehren enable row level security;

drop policy if exists reservation_portal_finanzen_tenant
  on public.reservation_portal_finanzen;
create policy reservation_portal_finanzen_tenant
  on public.reservation_portal_finanzen
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists reservation_portal_gebuehren_tenant
  on public.reservation_portal_gebuehren;
create policy reservation_portal_gebuehren_tenant
  on public.reservation_portal_gebuehren
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

revoke all on public.reservation_portal_finanzen from anon, authenticated;
revoke all on public.reservation_portal_gebuehren from anon, authenticated;

-- Realtime-Folge, ausdrücklich festgehalten: BEIDE Tabellen kommen NICHT in die
-- Publikation `supabase_realtime`. Ohne SELECT-Grant passt keine Policy, ein Abo
-- wäre eine stumme Attrappe (dasselbe gilt für payments/invoices, CLAUDE.md).
-- Ändert sich die Zerlegung, ändert sich immer auch die Buchung selbst — die
-- UI hört deshalb auf `reservations`, eine erlaubte Quelle.
