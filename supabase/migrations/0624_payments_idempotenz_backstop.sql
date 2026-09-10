-- 0624 — Wurzel-2-Backstop auf public.payments
--
-- BEFUND (10.09.2026): auf `payments` gab es KEINEN einzigen Unique-Index
-- ausser dem Primaerschluessel. Die Idempotenz haengt allein an
-- `PaymentsService._reuse_pending_intent` — und das ist ein read-then-write
-- ohne Sperre: zwei nebenlaeufige Anfragen (Doppelklick, Retry,
-- Webhook-Redelivery) lesen beide „keine pending-Zeile" und legen beide
-- einen Stripe-PaymentIntent an. Wurzel 2 verlangt genau dafuer den
-- UNIQUE-Backstop in der DB, nicht nur den Anwendungs-Guard.
--
-- Irrefuehrend war zusaetzlich 0172_payments_paypal_and_hardening.sql:27,30:
-- der Kommentar dort verspricht „Reuse offener PayPal-Orders (Doppelklick/
-- Retry, Wurzel 2)", die beiden Indizes sind aber NICHT unique — sie
-- beschleunigen nur die Suche und verhindern nichts.
--
-- Der Schluessel ist derselbe, nach dem `_reuse_pending_intent` sucht:
-- (reservation_id, type) bei status='pending'. Partiell, weil abgeschlossene
-- und fehlgeschlagene Zahlungen desselben Typs sehr wohl mehrfach vorkommen
-- (Erstattung nach Neuanlage, zweiter Versuch nach `failed`).
--
-- Live geprueft vor dem Einspielen: 0 Dubletten bei 12 Zeilen — der Index
-- greift ohne Datenbereinigung.
create unique index if not exists payments_pending_je_reservierung_typ_uidx
    on public.payments (reservation_id, type)
    where status = 'pending';

comment on index public.payments_pending_je_reservierung_typ_uidx is
    'Wurzel 2: verhindert doppelte offene Zahlungen je (Buchung, Typ). '
    'Der Anwendungs-Guard _reuse_pending_intent ist read-then-write und '
    'damit allein nicht rennsicher.';
