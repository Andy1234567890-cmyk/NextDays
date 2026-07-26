-- Verrechnungsposten gegen Doppelanlage sichern (Wurzel 2).
--
-- PROBLEM: Ein Storno erreicht `verrechne_storno` auf ZWEI Wegen —
--   1. der API-Refund (payments/service.py::_hole_zurueck_oder_verrechne)
--   2. der Stripe-Webhook `charge.refunded` (payments/webhook.py)
-- dazu Retries und Webhook-Redeliveries. Ohne Backstop entstehen mehrere
-- Forderungen über denselben Betrag; die nächste Auszahlung würde den Betrieb
-- mehrfach kürzen — echter Geldschaden, still.
--
-- Der Guard im Service (SELECT vor INSERT) fängt den Normalfall, aber nicht
-- zwei gleichzeitige Läufe: beide sehen "nichts da" und schreiben. Nur eine
-- UNIQUE-Bedingung in der DB ist dagegen dicht.
--
-- ABGRENZUNG: Eindeutig je (reservation_id, kind) — eine Buchung kann sehr wohl
-- eine Erstattung UND eine Stornogebühr tragen, aber nie zwei Erstattungen.
-- Manuelle Korrekturen (kind='correction') ohne reservation_id sind von einem
-- partiellen Index ohnehin ausgenommen.

create unique index if not exists payout_adjustments_je_buchung_und_art
    on public.payout_adjustments (reservation_id, kind)
    where reservation_id is not null;

comment on index public.payout_adjustments_je_buchung_und_art is
  'Ein Verrechnungsposten je Buchung und Art. Backstop gegen doppelte Anlage '
  'aus Refund-Pfad und charge.refunded-Webhook (Wurzel 2).';
