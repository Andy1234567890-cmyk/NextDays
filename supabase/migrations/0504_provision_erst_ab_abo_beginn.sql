-- Provision erst ab Abo-Beginn — der Abo-Start bekommt endlich ein Feld.
--
-- DAS PROBLEM (live gemessen am 30.08.2026, Betrieb AirSmil):
-- Die Provisionsaufstellung fuer August 2026 fuehrte 106 Buchungen mit
-- 2.705,06 DKK. Darunter Aufenthalte vom 02.01.2025 bis 05.08.2026 — also aus
-- der Zeit, bevor der Betrieb ueberhaupt Kunde war. Das Abo laeuft seit dem
-- 07.08.2026 (Stripe `start_date` von sub_1U1sVD1UAdGwIBFlDt5S0EAo).
--
-- WARUM SIE DA HINEINGERIETEN:
-- `record_commission` prueft heute drei Dinge — externer Kanal, Umsatz > 0,
-- Objekt veroeffentlicht. Eine Datumsgrenze gibt es NICHT. Wer ein Portal
-- verbindet, zieht seine Buchungshistorie mit, und jede einzelne davon erzeugt
-- eine Provisionszeile. Betroffen sind sieben Einlesewege (Channex-Connect,
-- import-existing?include_past, Voll-Abgleich, Revisions-Feed, CSV-Import,
-- Lodgify-Migration, manuelles Anlegen). Der Airbnb-Historien-Import macht es
-- als EINZIGER richtig und schreibt bewusst ohne Provision — mit genau dieser
-- Begruendung im Code: „Ein Import darf die Buchhaltung eines abgeschlossenen
-- Geschaeftsjahres nicht nachtraeglich veraendern."
--
-- WARUM ES NICHT PRUEFBAR WAR:
-- `tenant_subscription` speichert `current_period_end`, aber keinen Beginn.
-- Der stand bisher ausschliesslich bei Stripe. Ohne dieses Feld konnte keine
-- Grenze geprueft werden — deshalb legt diese Migration es an.
--
-- DIE REGEL (Entscheidung des Betreibers, 30.08.2026):
-- Massgeblich ist der AUFENTHALT, nicht das Buchungsdatum: gemanagt wird der
-- Aufenthalt, und ab dem Tag, an dem er in unserem System liegt, erbringen wir
-- die Leistung. Anreise >= Abo-Beginn → provisionspflichtig. Frueher → frei,
-- auch wenn die Buchung selbst spaeter hereinkam.

-- 1. Der Abo-Beginn als eigenes Feld.
--    Quelle ist Stripes `start_date` (Wurzel 5b: der Zeitpunkt des fremden
--    Ereignisses kommt aus der Quelle, nie von unserer Uhr). Gefuellt wird es
--    ab sofort im Webhook; hier nur der Bestand.
alter table public.tenant_subscription
  add column if not exists subscription_started_at timestamptz;

comment on column public.tenant_subscription.subscription_started_at is
  'Beginn des Abos aus Stripe (start_date). Grenze fuer die Provisionspflicht: '
  'nur Aufenthalte ab diesem Tag tragen Provision. NULL = unbekannt, dann wird '
  'fail-closed auf created_at der Zeile zurueckgegriffen.';

-- 2. Bestand fuellen.
--    AirSmil: der echte Stripe-Wert, am 30.08.2026 per API abgefragt
--    (start_date = billing_cycle_anchor = created = 2026-08-07T18:27:39Z).
update public.tenant_subscription
   set subscription_started_at = '2026-08-07 18:27:39+00'
 where stripe_subscription_id = 'sub_1U1sVD1UAdGwIBFlDt5S0EAo'
   and subscription_started_at is null;

--    Alle uebrigen: kein Stripe-Abo (die Demo-Betriebe fuers Marketing). Fuer
--    sie ist die Anlage der Abo-Zeile der Beginn — ein plausibler Ersatzwert
--    waere hier KEIN Fantasiewert (Wurzel 4), sondern die einzige Tatsache,
--    die wir haben.
update public.tenant_subscription
   set subscription_started_at = created_at
 where subscription_started_at is null;

-- 3. Die falsch erfassten offenen Provisionszeilen entfernen.
--    NUR 'pending' — eine bereits fakturierte Provision bleibt stehen, die
--    Rechnung wurde gestellt (dieselbe Linie wie `cancel_commission`).
--    Bereinigt wird nach ABSICHT, nicht nach Etikett: geloescht wird genau,
--    was die neue Regel auch kuenftig nicht mehr anlegen wuerde.
--
--    Wirkung bei AirSmil, vorher gemessen:
--      bleibt:      81 Buchungen, 1.989,17 DKK (Anreise ab 09.08.2026)
--      faellt weg:  25 Buchungen,   715,89 DKK (Anreise 02.01.2025–05.08.2026)
delete from public.commission_ledger cl
 using public.reservations r, public.tenant_subscription ts
 where cl.reservation_id = r.id
   and cl.tenant_id = ts.tenant_id
   and cl.status = 'pending'
   and ts.subscription_started_at is not null
   and r.check_in < (ts.subscription_started_at at time zone 'UTC')::date;
