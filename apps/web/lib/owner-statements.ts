"use server";

// Owner-Statements: Server-Actions gegen den FastAPI-owner_statements-Slice
// (/api/v1/owner-statements). Auszahlungsabrechnung je Eigentümer + Zeitraum,
// Rental activity, Expenses & Extras. Business-Logik bleibt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type StatementBasis = "check_in" | "check_out";
export type StatementStatus = "draft" | "finalized" | "cancelled";
export type StatementKind = "invoice" | "cancellation";

export type TaxBreakdown = {
  category: string; // EN BT-118: S | AE | E | Z
  rate: number;
  net: number;
  tax: number;
  gross: number;
  exemption_reason: string | null;
};

export type StatementHeader = {
  pm_name: string | null;
  pm_email: string | null;
  pm_phone: string | null;
  pm_address: string | null;
  pm_tax_id: string | null;
  pm_logo_url: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_address: string | null;
  owner_tax_id: string | null;
  invoice_number: string | null;
  notes: string | null;
};

export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type StatementSummary = {
  total_price: number;
  total_payout: number;
  expenses_total: number;
  owner_payout: number;
  pm_payout: number;
  currency: string;
  booking_count: number;
  // Owner-Zielwährung (aus Herkunftsland); owner_payout ist in DIESER Währung.
  owner_currency: string;
  // Verwaltungs-Auszahlung + Roh-Summen je Quellwährung (keine Mischsumme).
  pm_payout_by_currency: CurrencyAmount[];
  totals_by_currency: CurrencyAmount[];
};

export type RentalRow = {
  reservation_id: string;
  guest: string | null;
  nights: number;
  listing_id: string;
  listing: string | null;
  channel: string;
  total_price: number;
  total_payout: number;
  // Quellwährung der Buchung + Owner-Auszahlung (Buchungssatz) in Quell- und
  // Owner-Währung samt verwendetem Tageskurs/Stichtag.
  currency: string;
  owner_payout: number;
  owner_payout_converted: number;
  fx_rate: number;
  fx_date: string | null;
};

export type ListingRow = {
  listing_id: string;
  listing: string | null;
  nights: number;
  reservations: number;
  total_price: number;
  total_payout: number;
};

export type Expense = {
  id: string;
  tenant_id: string;
  statement_id: string | null;
  concept: string;
  date: string;
  category: string | null;
  listing_id: string | null;
  reservation_id: string | null;
  owner_id: string | null;
  amount: number;
  attachment_url: string | null;
  hidden_from_owner: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type Statement = {
  id: string;
  tenant_id: string;
  owner_id: string;
  period_from: string;
  period_to: string;
  basis: StatementBasis;
  reservation_statuses: string[];
  status: StatementStatus;
  kind: StatementKind;
  commission_pct: number;
  header: StatementHeader;
  summary: StatementSummary;
  invoice_date: string | null;
  due_date: string | null;
  supply_country: string | null;
  buyer_vat_id: string | null;
  tax: TaxBreakdown;
  cancels_statement_id: string | null;
  cancelled_by_statement_id: string | null;
  rental_rows: RentalRow[];
  listing_rows: ListingRow[];
  expenses: Expense[];
  created_at: string | null;
  updated_at: string | null;
};

export type StatementListItem = {
  id: string;
  owner_id: string;
  owner_name: string | null;
  period_from: string;
  period_to: string;
  status: StatementStatus;
  owner_payout: number;
  pm_payout: number;
  currency: string;
  invoice_number: string | null;
  created_at: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

export async function listStatements(
  ownerId?: string,
): Promise<Result<{ items: StatementListItem[]; total: number }>> {
  const q = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : "";
  return call(`/owner-statements${q}`);
}

export async function getStatement(id: string): Promise<Result<Statement>> {
  return call(`/owner-statements/${id}`);
}

export async function generateStatement(input: {
  owner_id: string;
  period_from: string;
  period_to: string;
  basis?: StatementBasis;
  reservation_statuses?: string[];
  commission_pct?: number | null;
}): Promise<Result<Statement>> {
  return call("/owner-statements", { method: "POST", body: input });
}

/** Live-Auswertung (Umsatz/Aktivität/Summen) für Owner + Zeitraum, OHNE zu
 * speichern. Für den Überblick auf der Owner-Seite. */
export async function previewStatement(input: {
  owner_id: string;
  period_from: string;
  period_to: string;
  basis?: StatementBasis;
  reservation_statuses?: string[];
  commission_pct?: number | null;
}): Promise<Result<Statement>> {
  return call("/owner-statements/preview", { method: "POST", body: input });
}

export async function updateStatement(
  id: string,
  input: {
    header?: Partial<StatementHeader>;
    commission_pct?: number | null;
    basis?: StatementBasis;
    reservation_statuses?: string[];
    period_from?: string;
    period_to?: string;
  },
): Promise<Result<Statement>> {
  return call(`/owner-statements/${id}`, { method: "PATCH", body: input });
}

export async function finalizeStatement(
  id: string,
): Promise<Result<Statement>> {
  return call(`/owner-statements/${id}/finalize`, { method: "POST" });
}

/** Finalisierte Rechnung stornieren → erzeugt eine Stornorechnung (eigene
 * Nummer, negierte Beträge) und gibt diese zurück. */
export async function cancelStatement(
  id: string,
): Promise<Result<Statement>> {
  return call(`/owner-statements/${id}/cancel`, { method: "POST" });
}

export async function deleteStatement(id: string): Promise<Result<null>> {
  return call(`/owner-statements/${id}`, { method: "DELETE" });
}

export async function addExpense(input: {
  statement_id?: string | null;
  concept: string;
  date: string;
  category?: string | null;
  listing_id?: string | null;
  reservation_id?: string | null;
  owner_id?: string | null;
  amount: number;
  attachment_url?: string | null;
  hidden_from_owner?: boolean;
}): Promise<Result<Expense>> {
  return call("/owner-statements/expenses", { method: "POST", body: input });
}

export async function updateExpense(
  id: string,
  input: Partial<Omit<Expense, "id" | "tenant_id" | "created_at" | "updated_at">>,
): Promise<Result<Expense>> {
  return call(`/owner-statements/expenses/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteExpense(id: string): Promise<Result<null>> {
  return call(`/owner-statements/expenses/${id}`, { method: "DELETE" });
}
