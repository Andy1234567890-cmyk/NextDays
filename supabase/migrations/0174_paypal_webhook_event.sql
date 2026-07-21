-- 0174_paypal_webhook_event.sql — Idempotenz-Tabelle für PayPal-Webhooks
--
-- Wie stripe_webhook_event: eine Zeile je verarbeiteter Zustellung. Der Handler
-- claimt ATOMAR über die transmission_id (pro Zustellung eindeutig) und über-
-- springt Redeliveries (Wurzel 2). Zusätzlich resource_id/event_type gespeichert,
-- damit dasselbe fachliche Event (z. B. eine Capture) nicht doppelt gespiegelt
-- wird. Nur der Server (service_role) schreibt/liest → RLS + revoke (Wurzel 6).

create table if not exists public.paypal_webhook_event (
    transmission_id text primary key,        -- PAYPAL-TRANSMISSION-ID (pro Zustellung)
    event_id        text,                    -- PayPal-Event-ID (resource-übergreifend)
    event_type      text not null,
    resource_id     text,                    -- z. B. capture-/order-id
    received_at     timestamptz not null default now()
);

create index if not exists paypal_webhook_event_resource_idx
    on public.paypal_webhook_event (resource_id, event_type)
    where resource_id is not null;

alter table public.paypal_webhook_event enable row level security;
-- Keine tenant-Policy: rein serverseitig (kein tenant-Bezug am Event selbst).
revoke all on public.paypal_webhook_event from anon, authenticated;

comment on table public.paypal_webhook_event is
  'Idempotenz-Log verarbeiteter PayPal-Webhook-Zustellungen (transmission_id). '
  'Nur service_role (revoke + RLS, Wurzel 6).';
