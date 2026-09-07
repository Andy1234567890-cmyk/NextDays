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

/** Ein einzelner, von Stripe zurückgewiesener Wert (requirements.errors). */
export interface StripeAnforderungsFehler {
  requirement: string;
  code: string;
  reason: string;
}

/**
 * Live-Status des Auszahlungskontos inkl. offener Pflichtangaben.
 *
 * ALLE Requirement-Listen einzeln (wie das Backend sie liefert): „jetzt
 * fällig", „überfällig", „später fällig" und „in Prüfung" verlangen
 * unterschiedliche Reaktionen — eine verschmolzene Liste behauptet
 * Handlungsbedarf, wo keiner ist.
 */
export interface AuszahlungsStatus {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  /** currently_due — offene Stripe-Requirements als rohe Feldpfade. */
  requirements: string[];
  /** Überfällig — der Account ist deshalb bereits eingeschränkt. */
  past_due: string[];
  /** Später fällig (noch ohne Frist). */
  eventually_due: string[];
  /** Eingereicht, Stripe prüft. */
  pending_verification: string[];
  errors: StripeAnforderungsFehler[];
  /** Unix-Sekunden, ab wann Stripe sperrt — null ohne Frist. */
  current_deadline: number | null;
  disabled_reason: string | null;
}

/**
 * Welche KYC-Felder Stripe für ein Land verlangt — live aus den country_specs,
 * getrennt nach Einzelperson und Firma. Daraus weiß die Oberfläche, ob eine
 * persönliche Kennnummer (individual.id_number) nötig ist.
 */
export interface LandAnforderungen {
  country: string;
  individual: { minimum: string[]; additional: string[] };
  company: { minimum: string[]; additional: string[] };
}

export async function getLandAnforderungen(
  land: string,
): Promise<LandAnforderungen | null> {
  try {
    return await api<LandAnforderungen>(
      `/payments/connect/country-requirements/${encodeURIComponent(land)}`,
      { cache: "no-store" },
    );
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/**
 * Die Konto-ID des eigenen Betriebs.
 *
 * Das Konto entsteht AUTOMATISCH beim Speichern der Stammdaten
 * (buchhaltung._ensure_connect_account) — es gibt bewusst keinen manuellen
 * Anlege-Schritt. `null` heißt: Stammdaten noch unvollständig.
 */
export async function getAuszahlungsKontoId(): Promise<string | null> {
  try {
    const res = await api<{ stripe_account_id: string | null }>(
      "/payments/connect/account",
      { cache: "no-store" },
    );
    return res.stripe_account_id ?? null;
  } catch {
    return null;
  }
}

/** Live-Status beim Zahlungsanbieter (nicht der DB-Spiegel). */
export async function getAuszahlungsStatus(
  kontoId: string,
): Promise<AuszahlungsStatus | null> {
  try {
    return await api<AuszahlungsStatus>(
      `/payments/connect/accounts/${encodeURIComponent(kontoId)}`,
      { cache: "no-store" },
    );
  } catch {
    return null;
  }
}
