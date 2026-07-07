"use server";

// Abo-Billing (Tenant → myNextDays) — Server-Actions gegen den FastAPI-
// subscriptions-Slice (/api/v1/subscriptions). Grundgebühr + Objekt-Staffel
// (graduated) + Zusatzmodule. GETRENNT vom Gast→Vermieter-Fluss (lib/payments).
// Beträge kommen aus Stripe (nie hier hardcoden). Alle Calls: JWT + MANAGE_BILLING.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/subscriptions${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen (spiegeln die Pydantic-Schemas) ---------------------------------

export type ModuleKey =
  | "modul3_buchhaltung"
  | "modul4_mitarbeiter"
  | "modul5_jobmarkt"
  | "modul6_hotel";

export type ModuleEntitlement = {
  module_key: string;
  active: boolean;
  active_until: string | null;
};

export type SubscriptionStatus = {
  has_subscription: boolean;
  status: string | null;
  stripe_customer_id: string | null;
  property_count: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  modules: ModuleEntitlement[];
};

export type PriceTier = {
  up_to: number | null;
  flat_amount: number | null; // Cent
  unit_amount: number | null; // Cent
};

export type ModulePrice = {
  module_key: string;
  lookup_key: string;
  unit_amount: number; // Cent
  per_unit_label: string | null;
};

export type Pricing = {
  currency: string;
  grundtarif_tiers: PriceTier[];
  modules: ModulePrice[];
};

// --- Actions ----------------------------------------------------------------

export async function getSubscriptionStatus(): Promise<Result<SubscriptionStatus>> {
  return call<SubscriptionStatus>("/status");
}

export async function getPricing(): Promise<Result<Pricing>> {
  return call<Pricing>("/pricing");
}

export async function startCheckout(input: {
  moduleKeys: string[];
  successUrl: string;
  cancelUrl: string;
}): Promise<Result<{ checkout_url: string }>> {
  return call<{ checkout_url: string }>("/checkout", {
    method: "POST",
    body: {
      module_keys: input.moduleKeys,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
  });
}

export async function openBillingPortal(
  returnUrl: string,
): Promise<Result<{ portal_url: string }>> {
  return call<{ portal_url: string }>(
    `/portal?return_url=${encodeURIComponent(returnUrl)}`,
    { method: "POST" },
  );
}

export type CommissionRow = {
  reservation_id: string;
  channel: string;
  currency: string;
  gross_amount: number;
  rate: number;
  commission_amount: number;
  status: string;
  period: string | null;
};

export type CommissionSummary = {
  current_rate: number; // 0.01 / 0.005
  pending_total: number;
  pending_count: number;
  currency: string | null;
  rows: CommissionRow[];
};

export async function getCommissions(): Promise<Result<CommissionSummary>> {
  return call<CommissionSummary>("/commissions");
}
