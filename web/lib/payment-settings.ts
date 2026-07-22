"use server";

// Zahlungs-Einstellungen (Tab „Zahlungen") — Server-Actions gegen den payments-
// Slice. Sensible Finanzdaten: nur mit gültigem Token, der Server erzwingt
// zusätzlich MANAGE_BILLING und schreibt nur die Zahlungs-Spalten (Whitelist).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type CardGateway = "none" | "stripe";

export type PaymentSettings = {
  active_card_gateway: CardGateway;
  paypal_email: string | null;
  manual_payments_enabled: boolean;
  // Name des Händlers auf der Kartenabrechnung (Stripe statement descriptor).
  merchant_name: string | null;
  // Verhaltens-Toggles der Kartenzahlung
  auto_charge_first_deposit: boolean;
  auto_charge_scheduled: boolean;
  auto_refund_on_cancel: boolean;
  auto_preauth_deposits: boolean;
  verify_card_before_booking: boolean;
  // Bankdaten für manuelle Zahlungen
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  account_holder: string | null;
};

// Response = Einstellungen + abgeleiteter Stripe-/PayPal-Status (read-only).
export type PaymentSettingsResponse = PaymentSettings & {
  stripe_connected: boolean;
  stripe_charges_enabled: boolean;
  paypal_onboarding_status: "not_started" | "pending" | "completed" | "revoked";
  paypal_connected: boolean;
};

const BASE = "/payments/settings";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PUT" | "POST"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
      status: exc instanceof ApiError ? exc.status : undefined,
    };
  }
}

export async function getPaymentSettings(): Promise<
  Result<PaymentSettingsResponse>
> {
  return call<PaymentSettingsResponse>(BASE);
}

export async function updatePaymentSettings(
  input: PaymentSettings,
): Promise<Result<PaymentSettingsResponse>> {
  return call<PaymentSettingsResponse>(BASE, { method: "PUT", body: input });
}

// PayPal-Onboarding starten → action_url, zu der der Betrieb umgeleitet wird, um
// sein eigenes PayPal-Geschäftskonto zu verbinden. return_url = wohin PayPal den
// Betrieb zurückschickt (unsere Dashboard-Seite).
export async function startPaypalOnboarding(
  returnUrl: string,
): Promise<Result<{ action_url: string }>> {
  return call<{ action_url: string }>("/payments/paypal/onboarding", {
    method: "POST",
    body: { return_url: returnUrl },
  });
}

// Onboarding-Status des eigenen Tenants bei PayPal nachladen (nach Rückkehr).
export async function syncPaypalStatus(): Promise<
  Result<{ receivable: boolean; email_confirmed: boolean }>
> {
  return call<{ receivable: boolean; email_confirmed: boolean }>(
    "/payments/paypal/status",
    { method: "POST" },
  );
}
