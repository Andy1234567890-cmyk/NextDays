-- 0172_payments_paypal_and_hardening.sql — PayPal-IDs auf payments + Wurzel-6
--
-- (A) PayPal braucht ZWEI IDs je Zahlung, nicht eine: die order_id (bei Create,
--     für Idempotenz/Reuse) und die capture_id (nach Capture bzw. aus dem
--     PAYMENT.CAPTURE.COMPLETED-Webhook; für den Refund /captures/{id}/refund).
--     Das einzelne gateway_ref (bei Stripe = PaymentIntent-ID) reicht dafür nicht
--     — Order- und Capture-ID sind bei PayPal verschieden.
--
-- (B) WURZEL 6 — payments war bisher NICHT gehärtet: RLS + permissive tenant-
--     Policy, aber die pauschalen anon/authenticated-GRANTs bestanden weiter →
--     ein eingeloggter cleaner konnte per anon-Key `curl /rest/v1/payments`
--     Zahlungen LESEN UND SCHREIBEN (inkl. stripe_customer_id/payment_method_id
--     und künftig paypal_capture_id). Das wird hier nachgezogen: GRANTs entziehen
--     + restriktive tenant-Policy (auch der Schreib-Pfad, nicht nur SELECT).
--     Danach spricht nur noch service_role (Server/Webhook) diese Tabelle.

-- (A) PayPal-IDs -------------------------------------------------------------
alter table public.payments
    -- PayPal-Order-ID (bei POST /v2/checkout/orders). Idempotenz/Reuse-Lookup.
    add column if not exists paypal_order_id text,
    -- PayPal-Capture-ID (aus Capture-Response / PAYMENT.CAPTURE.COMPLETED).
    -- Pflicht für den Refund (/v2/payments/captures/{capture_id}/refund).
    add column if not exists paypal_capture_id text;

-- Reuse offener PayPal-Orders (Doppelklick/Retry, Wurzel 2) + Webhook-Lookup
-- über die Order-ID. Nur wo gesetzt (partiell).
create index if not exists payments_paypal_order_idx
    on public.payments (paypal_order_id)
    where paypal_order_id is not null;
create index if not exists payments_paypal_capture_idx
    on public.payments (paypal_capture_id)
    where paypal_capture_id is not null;

-- (B) Wurzel-6-Härtung -------------------------------------------------------
revoke all on public.payments from anon, authenticated;

-- Bestehende permissive Policy (payments_via_reservation) bleibt; zusätzlich eine
-- RESTRIKTIVE, die auch bei versehentlichem Re-GRANT tenant-fremden Zugriff (lesen
-- UND schreiben) ausschließt. Tenant über die reservations-Zeile ableiten.
drop policy if exists payments_tenant_restrict on public.payments;
create policy payments_tenant_restrict
    on public.payments
    as restrictive
    for all
    using (
        exists (
            select 1 from public.reservations r
            where r.id = payments.reservation_id
              and r.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1 from public.reservations r
            where r.id = payments.reservation_id
              and r.tenant_id = public.current_tenant_id()
        )
    );

comment on column public.payments.paypal_capture_id is
  'PayPal-Capture-ID (Refund-Referenz). Sensibel: nur service_role (revoke+RLS).';
