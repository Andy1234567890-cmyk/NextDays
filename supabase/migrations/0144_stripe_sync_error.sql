-- 0144_stripe_sync_error.sql — sichtbarer Stripe-Sync-Fehler (fail-closed statt fail-open)
--
-- Bisher wurde ein fehlgeschlagener Stripe-Connect-Sync beim Speichern der
-- Firmendaten nur geloggt (log.warning) — der Nutzer sah „Daten gespeichert",
-- obwohl die KYC-Daten NIE bei Stripe ankamen (fail-open, Wurzel 5). Diese Spalte
-- hält den letzten Sync-Fehler, damit die Zahlungen-Karte ihn anzeigen kann. NULL
-- = letzter Sync erfolgreich (oder noch keiner gelaufen).

alter table public.tenant_billing_profile
    add column if not exists stripe_sync_error text;
