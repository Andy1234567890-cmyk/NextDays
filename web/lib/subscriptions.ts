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
  | "modul6_hotel"
  | "modul7_avatar"
  | "dynamische_preise";

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
  // Nutzungsabhängige Module (Dynamische Preise): Prozentsatz vom
  // Buchungsumsatz statt Monatsbetrag. Dann ist unit_amount 0.
  usage_percent: number | null;
};

export type Pricing = {
  currency: string;
  grundtarif_tiers: PriceTier[];
  modules: ModulePrice[];
};

/**
 * Preisliste PLUS Provisionskonditionen — die Antwort von
 * `/subscriptions/public/pricing` (dasselbe, was die Marketing-Preisseite
 * holt, `marketing/lib/preise.ts`).
 *
 * WARUM ZUSÄTZLICH ZU `Pricing`: die Provisionssätze und der Monatsdeckel
 * liegen NICHT in Stripe, sondern als benannte Konstanten im
 * subscriptions-Slice (`COMMISSION_RATE_STANDARD`,
 * `MARKETPLACE_FEE_BPS_STANDARD`, `COMMISSION_CAP_EUR`). Der geschützte
 * `/pricing` liefert sie deshalb nicht mit. Sie im Tarifrechner als „0,5 %"/
 * „8 %"/„250 €" hinzuschreiben war genau die Doppelquelle, die Wurzel 4
 * verbietet — bei einer Satzänderung im Backend hätte die Karte weiter den
 * alten Satz behauptet, ohne dass tsc, ESLint oder ein Test es merkt.
 *
 * Der Deckel trägt seine Währung mit: ein Betrag ohne Währung ist in 27
 * EU-Ländern eine andere Zahl.
 */
export type PublicPricing = Pricing & {
  commission_marketplace_percent: number;
  commission_external_percent: number;
  commission_external_cap_amount: number;
  commission_external_cap_currency: string;
};

// --- Actions ----------------------------------------------------------------

export async function getSubscriptionStatus(): Promise<Result<SubscriptionStatus>> {
  return call<SubscriptionStatus>("/status");
}

export async function getPricing(): Promise<Result<Pricing>> {
  return call<Pricing>("/pricing");
}

/**
 * Preisliste samt Provisionskonditionen — OHNE Login (der Endpunkt ist
 * öffentlich, er enthält nur unsere eigene Preisliste, keine Tenant-Daten).
 *
 * Bewusst nicht über `call()`: das verlangt ein Token und gäbe ohne Session
 * „Nicht angemeldet." zurück, obwohl der Endpunkt keins braucht. Backend-seitig
 * ist er per TTL-Cache und `listings`-Rate-Limit-Bucket gedeckt.
 */
export async function getPublicPricing(): Promise<Result<PublicPricing>> {
  try {
    const data = await api<PublicPricing>("/subscriptions/public/pricing");
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
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
  current_rate: number; // 0.005 (einheitlich, keine Objektzahl-Staffel)
  pending_total: number;
  pending_count: number;
  currency: string | null;
  // Monatsdeckel (250 €, in die Währung der offenen Provisionen umgerechnet).
  // null, solange es keine offenen Zeilen gibt oder kein Kurs beschaffbar war.
  cap_amount: number | null;
  pending_capped: boolean;
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
  // Alle Werte des DB-Enums public.commission_status (0006) plus "mixed":
  // das Backend (get_commission_months) reicht den Zeilen-Status unverändert
  // durch, sobald der Monat einheitlich ist, und setzt sonst "mixed". "paid"
  // fehlte hier früher — dadurch war ein realer UI-Absturz bei einem voll
  // bezahlten Monat für tsc unsichtbar.
  status: CommissionStatus;
  /**
   * Monatsdeckel in `currency` und der davon tatsächlich berechnete Betrag
   * (`min(commission_total, cap_amount)`).
   *
   * `commission_total` ist die ENTSTANDENE Provision — bei erreichtem Deckel
   * nicht die Zahl, die der Betrieb zahlt. Beide Felder sind `null`, wenn kein
   * ECB-Kurs beschaffbar war oder der Monat gemischte Währungen trägt: dann
   * gibt es keinen Deckel, der sich ohne Raten benennen ließe (Wurzel 4).
   */
  cap_amount: number | null;
  billed_total: number | null;
};

/** Monatsstatus der Provisionen: DB-Enum commission_status + Sammelwert. */
export type CommissionStatus = "pending" | "invoiced" | "paid" | "mixed";

export async function getCommissionMonths(
  limit = 24,
): Promise<Result<CommissionMonth[]>> {
  return call<CommissionMonth[]>(`/commission-months?limit=${limit}`);
}

/**
 * Eine Buchung in der vorläufigen Aufstellung eines Monats.
 *
 * `rate` ist der eingefrorene Satz DIESER Zeile (dezimal, 0.005 = 0,5 %), nicht
 * der heutige Tarifsatz — eine spätere Tarifänderung schreibt die Vergangenheit
 * nicht um.
 *
 * Objekt, Gast und Zeitraum können fehlen: die Provisionszeile ist eine
 * Forderung und überlebt eine gelöschte Reservierung. Dann bleibt das Feld leer,
 * statt einen Ersatztext zu zeigen (Wurzel 4).
 *
 * `status` ist bewusst `string`: das Backend reicht den DB-Enum-Wert
 * unverändert durch, ein Literal hier verspräche eine Prüfung, die zur Laufzeit
 * niemand vornimmt — dieselbe Begründung wie bei `CommissionMonth.status`.
 */
export type CommissionEntry = {
  id: string;
  channel: string;
  currency: string | null;
  gross_amount: number;
  rate: number;
  commission_amount: number;
  status: string;
  /** Wann die Provisionszeile bei UNS entstand (Import/Erfassung). */
  erfasst_am: string;
  /**
   * Echter Buchungszeitpunkt beim Portal. `null`, wenn die Quelle ihn nicht
   * mitliefert (CSV-Import, Lodgify-Migration, manuell erfasst) — dann bleibt
   * die Spalte leer, statt auf `erfasst_am` auszuweichen: unsere Uhr ist nie
   * der Zeitpunkt eines fremden Ereignisses (Wurzel 5b).
   */
  booked_at: string | null;
  property_title: string | null;
  check_in: string | null;
  check_out: string | null;
  guest_name: string | null;
};

export async function getCommissionEntries(
  period: string,
): Promise<Result<CommissionEntry[]>> {
  return call<CommissionEntry[]>(
    `/commission-months/${encodeURIComponent(period)}/entries`,
  );
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
