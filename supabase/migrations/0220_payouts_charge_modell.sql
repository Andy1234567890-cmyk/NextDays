-- Altzeilen aus der Destination-Charge-Ära vom Auszahlungslauf ausnehmen.
--
-- PROBLEM: Solange STRIPE_SEPARATE_TRANSFERS aus ist, reicht der Charge das
-- Geld sofort an den Betrieb weiter (transfer_data.destination). Die trotzdem
-- angelegten payouts-Zeilen sind reine Buchführung — ihr Geld IST BEREITS
-- GEFLOSSEN. Wird das Flag umgelegt, würde der erste Lauf genau diese Zeilen
-- abarbeiten und ein ZWEITES Mal auszahlen, aus dem Plattform-Saldo.
--
-- Der Code-Guard (_trennt_charge_und_transfer) schützt davor NICHT: Er kennt
-- nur den aktuellen Flag-Zustand, nicht die Herkunft einer einzelnen Zeile.
--
-- LÖSUNG: Jede Zeile trägt fest, unter welchem Modell sie entstanden ist. Der
-- Lauf zahlt ausschließlich 'separate'-Zeilen aus. Zeilen aus der Altwelt
-- bleiben als Beleg stehen, ohne je Geld zu bewegen.

create type public.payout_charge_modell as enum ('destination', 'separate');

alter table public.payouts
    add column if not exists charge_modell public.payout_charge_modell
        not null default 'destination';

comment on column public.payouts.charge_modell is
  'Unter welchem Zahlungsmodell die Zeile entstand. destination = Geld ging '
  'schon per transfer_data an den Betrieb (Altwelt, NIE auszahlen). '
  'separate = Geld liegt auf dem Plattform-Saldo und wird von dieser Zeile '
  'freigegeben. Der Auszahlungslauf verarbeitet nur separate.';

-- Bestand ist per Definition Altwelt: Zum Zeitpunkt dieser Migration war
-- STRIPE_SEPARATE_TRANSFERS noch nicht aktiv. Der Default deckt das ab; das
-- explizite Update dokumentiert die Absicht und schützt vor einem später
-- geänderten Default.
update public.payouts set charge_modell = 'destination'
 where charge_modell is distinct from 'destination';

-- Der Lauf filtert über (status, due_at) und jetzt zusätzlich charge_modell.
create index if not exists payouts_faellig_separate_idx
    on public.payouts (due_at)
    where charge_modell = 'separate'
      and status in ('scheduled', 'due', 'failed');

comment on index public.payouts_faellig_separate_idx is
  'Auszahlungslauf: fällige Zeilen der Separate-Charges-Welt.';
