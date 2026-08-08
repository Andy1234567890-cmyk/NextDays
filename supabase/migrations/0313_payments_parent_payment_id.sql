-- Erstattungen brauchen den Bezug zur erstatteten Zahlung.
--
-- Problem: `payments` kannte bis hier keine Eltern-Verknüpfung. Eine
-- refund-Zeile trug nur `reservation_id`. `refund_payment` prüfte deshalb den
-- noch erstattbaren Rest, indem es den Betrag GENAU DIESER Zahlung gegen die
-- Summe ALLER Erstattungen der ganzen Buchung hielt. Bei einer Buchung mit
-- Zahlungsplan (Anzahlung + Restzahlung) ergibt das falsche Grenzen:
--
--   100 Anzahlung + 400 Rest, Anzahlung voll erstattet (100).
--   Danach die Restzahlung erstatten → remaining = 400 − 100 = 300;
--   mehr als 300 wird mit 422 abgewiesen, die letzten 100 bekommt der Gast
--   über diesen Weg nie zurück.
--
--   Umgekehrt: Teilerstattung der Restzahlung über 300 →
--   is_full = (100 + 300) >= 400 → Zahlung UND Reservierung gelten als
--   vollständig erstattet, der Status-Guard blockiert danach jede weitere
--   legitime Erstattung.
--
-- Mit `parent_payment_id` rechnet die Prüfung wieder auf derselben Ebene:
-- Betrag dieser Zahlung gegen die Erstattungen dieser Zahlung.
--
-- Nullable und ohne Backfill: Bestandszeilen bleiben unverändert. Der Dienst
-- fällt für sie auf die alte, buchungsweite Summe zurück (dokumentiert in
-- `_refunded_sum`) — das ist für Alt-Daten die konservative Variante und
-- ändert kein bestehendes Verhalten rückwirkend.

alter table public.payments
  add column if not exists parent_payment_id uuid
    references public.payments(id) on delete set null;

comment on column public.payments.parent_payment_id is
  'Bei type=refund: die erstattete Ursprungszahlung. Sonst NULL.';

-- Der Lesepfad ist "alle Erstattungen zu Zahlung X" — genau diese Richtung.
create index if not exists payments_parent_payment_idx
  on public.payments (parent_payment_id)
  where parent_payment_id is not null;
