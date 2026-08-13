-- 0387_stripe_branding_logo.sql — Firmenlogo auf der Stripe-Zahlseite
--
-- Das Logo, das der Gast beim Bezahlen sieht (Zahlungslink, Checkout, Belege),
-- kommt aus dem BRANDING DES VERBUNDENEN KONTOS bei Stripe — nicht aus unserer
-- Datenbank. Bisher wurde `company_logo_url` nur bei uns und an den Portalen
-- gepflegt; die Stripe-Zahlseite zeigte deshalb den grauen Platzhalter neben
-- dem Firmennamen (live gesehen am 13.08.2026 bei einem Zahlungslink).
--
-- Diese Spalte hält fest, WELCHE Logo-URL zuletzt zu Stripe übertragen wurde.
-- Ohne sie lädt jeder Profil-Sync eine weitere Datei in das Stripe-Konto hoch,
-- obwohl sich nichts geändert hat. Der Vergleich ist exakt (die URL trägt einen
-- Cache-Buster, ändert sich also bei jedem neuen Logo).

alter table public.tenant_billing_profile
    add column if not exists stripe_branding_logo_url text;

comment on column public.tenant_billing_profile.stripe_branding_logo_url is
  'Zuletzt an Stripe (settings.branding) übertragene company_logo_url. '
  'NULL = noch nie übertragen. Verhindert, dass jeder Sync eine weitere '
  'Datei im verbundenen Konto anlegt.';
