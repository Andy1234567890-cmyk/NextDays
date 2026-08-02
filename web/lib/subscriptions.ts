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
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
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
  billed_property_count: number | null;
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
  // Stripe-Preise können gestaffelt sein (tiers_mode). Aktuell hat kein Modul
  // eine Staffel — das Feld bildet die Stripe-Antwort vollständig ab.
  tiers: PriceTier[] | null;
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
  // Objektzahl aus dem Tarifrechner. Ohne sie zeigte Stripe einen anderen
  // Betrag als die Tarifseite (Server nähme sonst nur die aktiven Objekte).
  propertyCount?: number;
}): Promise<Result<{ checkout_url: string }>> {
  return call<{ checkout_url: string }>("/checkout", {
    method: "POST",
    body: {
      module_keys: input.moduleKeys,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      property_count: input.propertyCount,
    },
  });
}

/** Zusatzmodul zum laufenden Abo hinzubuchen (anteilig sofort berechnet).
 *  Ohne laufendes Abo antwortet der Server mit 422 — dann führt der Weg über
 *  den Tarifrechner, nicht hierüber (sonst zweites Abo, doppelte Grundgebühr). */
export async function addSubscriptionModule(
  moduleKey: ModuleKey,
): Promise<Result<ModuleEntitlement>> {
  return call<ModuleEntitlement>("/modules", {
    method: "POST",
    body: { module_key: moduleKey },
  });
}

/** Zusatzmodul kündigen — Zugang bleibt bis zum Ende der bezahlten Periode. */
export async function removeSubscriptionModule(
  moduleKey: ModuleKey,
): Promise<Result<ModuleEntitlement>> {
  return call<ModuleEntitlement>(`/modules/${moduleKey}`, { method: "DELETE" });
}

/** Gebuchte Objektzahl eines bestehenden Abos ändern. Erweitern gilt sofort
 *  (anteilige Berechnung); Reduzieren lehnt der Server ab, solange mehr
 *  Objekte veröffentlicht sind. */
export async function changeSubscriptionQuantity(
  propertyCount: number,
): Promise<Result<{ property_count: number }>> {
  return call<{ property_count: number }>("/quantity", {
    method: "POST",
    body: { property_count: propertyCount },
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

export type CommissionMonth = {
  period: string; // YYYY-MM
  charge_date: string; // 1. des Folgemonats
  booking_count: number;
  gross_total: number;
  commission_total: number;
  currency: string | null; // null = gemischte Währungen im Monat
  status: "pending" | "invoiced" | "mixed";
};

export async function getCommissionMonths(
  limit = 24,
): Promise<Result<CommissionMonth[]>> {
  return call<CommissionMonth[]>(`/commission-months?limit=${limit}`);
}

// --- Rechnungsadresse + Rechnungsverlauf (Quelle: Stripe-Customer) ----------

export type BillingAddress = {
  first_name: string | null;
  last_name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null; // ISO-3166-1 alpha-2
  email: string | null;
  account_type: "individual" | "company";
  company_name: string | null;
  vat_id: string | null;
};

export type InvoiceRow = {
  id: string;
  number: string | null;
  description: string | null;
  created: string;
  total: number;
  currency: string;
  status: string | null;
  pdf_url: string | null;
};

export async function getBillingAddress(): Promise<Result<BillingAddress>> {
  return call<BillingAddress>("/billing-address");
}

export async function updateBillingAddress(
  addr: BillingAddress,
): Promise<Result<BillingAddress>> {
  return call<BillingAddress>("/billing-address", { method: "PUT", body: addr });
}

export async function getInvoices(limit = 24): Promise<Result<InvoiceRow[]>> {
  return call<InvoiceRow[]>(`/invoices?limit=${limit}`);
}
