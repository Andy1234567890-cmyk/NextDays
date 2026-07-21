-- 0169_payment_settings.sql — Zahlungs-Einstellungen (neues Tab „Zahlungen")
--
-- Zweites Einstellungen-Tab (Lodgify-Modell „Zahlungen"): welche Zahlungsmethoden
-- ein Betrieb anbietet und wie sich die Kartenzahlung automatisch verhält. Die
-- Werte liegen auf tenant_billing_profile (dort sitzt bereits Stripe-Connect +
-- IBAN/Bankdaten) — keine neue Tabelle, sonst zwei Wahrheitsquellen fürs Billing.
--
-- Modell (recherche-belegt, Lodgify-KB):
--   * Genau EIN Karten-Acquirer aktiv (active_card_gateway) — heute nur Stripe.
--   * PayPal ist ein eigener Kanal (paypal_email), parallel zur Karte.
--   * Manuelle Zahlungen (Überweisung/Bar/POS) als eigener Schalter, parallel.
--   * Vier Verhaltens-Toggles der Kartenzahlung = GATES über die bereits gebaute
--     Split-Payment/Kautions/Storno-Logik (kein neuer Automatik-Flow erfunden):
--       - auto_charge_scheduled     → Worker zieht die geplante Restzahlung
--                                     off-session; steuert im Checkout auch das
--                                     Speichern der Karte (save_payment_method).
--       - auto_refund_on_cancel     → cancel() löst die policy-konforme Stripe-
--                                     Rückerstattung aus (sonst nur berechnet).
--       - auto_preauth_deposits     → Kautions-Vorautorisierung platzieren.
--       - verify_card_before_booking→ Karte vor Bestätigung verifizieren
--                                     (SetupIntent).
--
-- SICHERHEIT (Wurzel 6): tenant_billing_profile ist eine hochsensible Finanz-
-- tabelle (Stripe-Account, IBAN, Steuernummer) und hatte bisher NUR RLS +
-- pauschale anon/authenticated-GRANTs → ein eingeloggter cleaner konnte per
-- anon-Key IBAN/Stripe-Daten LESEN UND ÄNDERN. Diese Migration schließt die
-- Lücke: pauschale GRANTs entziehen + restriktive tenant-Policy (nicht nur
-- permissive). Danach spricht nur noch service_role diese Tabelle.

-- ============================================================================
-- Spalten: aktive Zahlungsmethoden + Verhaltens-Toggles
-- ============================================================================
alter table public.tenant_billing_profile
    -- Genau ein Karten-Acquirer. 'none' = keine Online-Kartenzahlung aktiv.
    add column if not exists active_card_gateway text
        not null default 'none'
        check (active_card_gateway in ('none', 'stripe')),
    -- PayPal-Kanal (eigene Achse, parallel zur Karte). NULL = aus.
    add column if not exists paypal_email text,
    -- Manuelle Zahlungen (Überweisung/Bar/POS). Die Bankdaten (iban/bic/…) liegen
    -- bereits in dieser Tabelle; dieser Schalter aktiviert die Methode.
    add column if not exists manual_payments_enabled boolean
        not null default false,

    -- --- Verhaltens-Toggles der Kartenzahlung -------------------------------
    -- Restzahlung automatisch off-session einziehen (Worker) + Karte im Checkout
    -- speichern. AUS = nur Zahlungslink/Erinnerung, keine gespeicherte Karte.
    add column if not exists auto_charge_scheduled boolean
        not null default true,
    -- Bei Storno automatisch die policy-konforme Rückerstattung auslösen.
    -- AUS = Betrag wird nur berechnet/angezeigt, manuell auszulösen.
    add column if not exists auto_refund_on_cancel boolean
        not null default true,
    -- Kaution automatisch vorautorisieren (Stripe manual-capture Hold).
    add column if not exists auto_preauth_deposits boolean
        not null default false,
    -- Karte vor Buchungsbestätigung verifizieren (SetupIntent, ohne Belastung).
    add column if not exists verify_card_before_booking boolean
        not null default false;

comment on column public.tenant_billing_profile.active_card_gateway is
  'Aktiver Karten-Acquirer (genau einer): none|stripe. PayPal/manual sind '
  'eigene, parallele Achsen.';
comment on column public.tenant_billing_profile.auto_charge_scheduled is
  'Restzahlung automatisch off-session einziehen + Karte im Checkout speichern.';

-- ============================================================================
-- Wurzel 6 — Direktpfad schließen. RLS + permissive Policy allein reichen NICHT:
-- die pauschalen GRANTs lassen anon/authenticated per PostgREST direkt an die
-- Tabelle. Erst GRANTs entziehen, dann eine RESTRIKTIVE tenant-Policy setzen,
-- die auch den SCHREIB-Pfad tenant-eng hält (nicht nur SELECT).
-- ============================================================================
revoke all on public.tenant_billing_profile from anon, authenticated;

-- Bestehende permissive tenant-Policy bleibt; zusätzlich eine restriktive, damit
-- selbst bei versehentlichem Re-GRANT kein tenant-fremder Zugriff möglich ist.
drop policy if exists tenant_billing_profile_tenant_restrict
    on public.tenant_billing_profile;
create policy tenant_billing_profile_tenant_restrict
    on public.tenant_billing_profile
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

comment on table public.tenant_billing_profile is
  'Abrechnungs-/Zahlungsprofil des Tenants (Stripe-Connect, IBAN, Steuer, '
  'Zahlungsmethoden + Verhaltens-Toggles). Sensibel: nur service_role '
  '(revoke + RLS + restriktive Policy, Wurzel 6).';
