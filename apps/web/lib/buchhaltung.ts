"use server";

// Buchhaltung: Server-Actions gegen den FastAPI-buchhaltung-Slice
// (/api/v1/buchhaltung). Rechnungen + Kunden, tenant-scoped. Beträge werden
// im Backend berechnet (Decimal). Business-Logik bleibt im Backend (PROJECT.md §2).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/buchhaltung${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen ------------------------------------------------------------------
export type Customer = {
  id: string;
  tenant_id: string;
  name: string;
  customer_number: string | null;
  email: string | null;
  phone: string | null;
  vat_id: string | null;
  is_supplier: boolean;
  customer_type: string;
};

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export type InvoiceListItem = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  invoice_type: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  gross_amount: string;
  currency: string;
  is_locked: boolean;
  created_at: string;
};

export type LineItemInput = {
  description: string;
  quantity: string;
  unit?: string | null;
  unit_price: string;
  tax_rate: string;
  discount_percent?: string;
};

export type InvoiceInput = {
  customer_id?: string | null;
  invoice_type?: string;
  status?: InvoiceStatus;
  issue_date?: string | null;
  due_date?: string | null;
  currency?: string;
  head_text?: string | null;
  footer_text?: string | null;
  notes?: string | null;
  items: LineItemInput[];
};

// --- Kunden -----------------------------------------------------------------
// Das Backend liefert /customers als Array (Bestands-Format). Für die
// Nachbau-Seiten (angebote/kunden) wird es hier in {items,total} gewrappt.
export async function listCustomers(): Promise<
  Result<{ items: Customer[]; total: number }>
> {
  const res = await call<Customer[]>("/customers");
  if (!res.ok) return res;
  const items = Array.isArray(res.data) ? res.data : [];
  return { ok: true, data: { items, total: items.length } };
}

export type CustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  vat_id?: string | null;
  customer_type?: string;
  is_supplier?: boolean;
  notes?: string | null;
};

export async function createCustomer(
  input: CustomerInput,
): Promise<Result<Customer>> {
  const res = await call<Customer>("/customers", { method: "POST", body: input });
  if (res.ok) revalidatePath("/buchhaltung/kunden");
  return res;
}

// --- Rechnungen -------------------------------------------------------------
export async function listInvoices(): Promise<
  Result<{ items: InvoiceListItem[]; total: number }>
> {
  return call("/invoices");
}

export async function getInvoice(id: string): Promise<Result<unknown>> {
  return call(`/invoices/${id}`);
}

export async function createInvoice(
  input: InvoiceInput,
): Promise<Result<{ id: string }>> {
  const res = await call<{ id: string }>("/invoices", {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath("/buchhaltung");
  return res;
}

export async function deleteInvoice(id: string): Promise<Result<void>> {
  const res = await call<void>(`/invoices/${id}`, { method: "DELETE" });
  if (res.ok) revalidatePath("/buchhaltung");
  return res;
}

// --- Angebote ---------------------------------------------------------------
export type QuoteStatus =
  | "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export type QuoteListItem = {
  id: string;
  quote_number: string | null;
  customer_id: string | null;
  status: QuoteStatus;
  issue_date: string | null;
  valid_until: string | null;
  gross_amount: string;
  currency: string;
  converted_invoice_id: string | null;
  created_at: string;
};

export type QuoteInput = {
  customer_id?: string | null;
  status?: QuoteStatus;
  issue_date?: string | null;
  valid_until?: string | null;
  currency?: string;
  notes?: string | null;
  items: LineItemInput[];
};

export async function listQuotes(): Promise<
  Result<{ items: QuoteListItem[]; total: number }>
> {
  return call("/quotes");
}

export async function createQuote(
  input: QuoteInput,
): Promise<Result<{ id: string }>> {
  const res = await call<{ id: string }>("/quotes", { method: "POST", body: input });
  if (res.ok) revalidatePath("/buchhaltung/angebote");
  return res;
}

export async function deleteQuote(id: string): Promise<Result<void>> {
  const res = await call<void>(`/quotes/${id}`, { method: "DELETE" });
  if (res.ok) revalidatePath("/buchhaltung/angebote");
  return res;
}

export async function convertQuote(id: string): Promise<Result<{ id: string }>> {
  const res = await call<{ id: string }>(`/quotes/${id}/convert`, { method: "POST" });
  if (res.ok) {
    revalidatePath("/buchhaltung/angebote");
    revalidatePath("/buchhaltung");
  }
  return res;
}
