-- 0291 — Wann hat der Gast WIRKLICH gebucht? (`reservations.booked_at`)
--
-- DER ANLASS (06.08.2026, live gemessen): Der Posteingang zeigte 22 Airbnb-
-- Buchungen als „heute 10:48". Tatsächlich stammten sie vom 23.03., 01.06. und
-- 26.07.2026 — die älteste war viereinhalb Monate alt. Angezeigt wurde
-- `reservations.created_at`, also wann WIR die Zeile angelegt haben.
--
-- WARUM DAS NICHT ÜBER CHANNEX ZU HEILEN IST: Channex' `inserted_at` steht bei
-- allen 22 auf derselben Sekunde (`2026-08-06T08:48:57`) — der Moment, in dem
-- Channex sie selbst anlegte. Das Feld `ota_booked_at` existiert dort zwar,
-- ist aber leer (`None`, live geprüft). Der Aggregator gibt den echten
-- Buchungszeitpunkt schlicht nicht heraus.
--
-- Die einzige verlässliche Quelle ist das Portal selbst: Airbnbs
-- `GET v2/reservations` liefert `booked_at` je Reservierung
-- (z. B. HMPKWNHQNF → 2026-03-23T15:24:55Z). Deshalb eine eigene Spalte, die
-- NUR aus der Portal-Antwort gefüllt wird.
--
-- NULLABLE UND KEIN DEFAULT (Wurzel 4): Wo das Portal kein Datum liefert,
-- bleibt die Spalte leer. Ein `default now()` oder ein Rückfall auf
-- `created_at` wäre genau der Fehler, den diese Migration behebt — dann stünde
-- wieder ein plausibler, aber falscher Zeitpunkt da. Die Oberfläche zeigt bei
-- NULL das Anlagedatum und kennzeichnet es als solches.

alter table public.reservations
  add column if not exists booked_at timestamptz;

comment on column public.reservations.booked_at is
  'Wann der Gast beim Portal gebucht hat (Airbnb `booked_at`). NULL = Portal '
  'liefert es nicht — dann NICHT durch created_at ersetzen, das ist unser '
  'Anlagezeitpunkt und war der Grund für 0291.';

-- Sortierung „neueste Buchung zuerst" im Posteingang und in der Buchungsliste.
-- Partiell: gefüllte Werte sind der Regelfall bei Airbnb, NULL bei Kanälen
-- ohne das Feld — die brauchen den Index nicht.
create index if not exists reservations_booked_at_idx
  on public.reservations (tenant_id, booked_at desc)
  where booked_at is not null;
