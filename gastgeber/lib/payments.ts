// Data-Layer Zahlungs-/Auszahlungsstatus (Server Component) über den DAL.
// GET /payments/settings liefert den abgeleiteten Stripe-Verbindungsstatus
// OHNE zweiten Stripe-Call (aus der DB) — für die „Schritte zum Veröffentlichen".
import { api, ApiError } from "./api-server";

export interface PaymentSettings {
  stripe_connected: boolean;
  stripe_charges_enabled: boolean;
  paypal_onboarding_status: string;
  paypal_connected: boolean;
}

/** Zahlungsstatus des Tenants (oder null, wenn noch nichts eingerichtet). */
export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  try {
    return await api<PaymentSettings>("/payments/settings");
  } catch (exc) {
    // Noch kein Billing-Profil / kein Zugriff → als „nicht eingerichtet" werten
    // (die Schritte-Karte zeigt dann „offen"), nicht crashen (Wurzel 5).
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
