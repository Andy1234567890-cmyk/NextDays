"use server";

// Buchhaltung → Ausgaben: Server-Actions gegen den Bereich »ausgaben« des
// FastAPI-buchhaltung-Slice (/api/v1/buchhaltung/expenses …). Beträge rechnet
// das Backend (Decimal); hier nur Transport. Typen in
// buchhaltung-ausgaben-typen.ts — eine "use server"-Datei darf AUSSCHLIESSLICH
// async functions exportieren.
import { revalidatePath } from "next/cache";

import { ApiError, api, apiBasis } from "@/lib/api";
import type {
  Expense,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseFilter,
  ExpenseInput,
  ExpenseList,
  ExpenseUpdateInput,
  ReceiptExtraction,
  ReceiptUrl,
  RecurringRunResult,
  Result,
} from "@/lib/buchhaltung-ausgaben-typen";
import { currentToken } from "@/lib/session-token";

const SEITE = "/buchhaltung/ausgaben";

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

// Multipart geht DIREKT ans FastAPI mit Bearer-Token: `api()` setzt
// application/json, und der Next-Proxy liest den Rumpf als Text — beides
// zerstört einen Multipart-Body (Muster wie uploadFirmenLogo/mappeDokumentLesen).
async function multipart<T>(path: string, file: File): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${apiBasis()}/buchhaltung${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail, status: res.status };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

function query(filter: ExpenseFilter): string {
  const p = new URLSearchParams();
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.status) p.set("status", filter.status);
  if (filter.categoryId) p.set("categoryId", filter.categoryId);
  if (filter.recurring !== undefined) p.set("recurring", String(filter.recurring));
  if (filter.search) p.set("search", filter.search);
  if (filter.limit) p.set("limit", String(filter.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// --- Ausgaben -----------------------------------------------------------------

export async function listExpenses(filter: ExpenseFilter = {}): Promise<Result<ExpenseList>> {
  return call<ExpenseList>(`/expenses${query(filter)}`);
}

export async function getExpense(id: string): Promise<Result<Expense>> {
  return call<Expense>(`/expenses/${encodeURIComponent(id)}`);
}

export async function createExpense(input: ExpenseInput): Promise<Result<Expense>> {
  const res = await call<Expense>("/expenses", { method: "POST", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function updateExpense(
  id: string,
  input: ExpenseUpdateInput,
): Promise<Result<Expense>> {
  const res = await call<Expense>(`/expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function deleteExpense(id: string): Promise<Result<null>> {
  const res = await call<null>(`/expenses/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function lockExpense(id: string): Promise<Result<Expense>> {
  const res = await call<Expense>(`/expenses/${encodeURIComponent(id)}/lock`, {
    method: "POST",
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function uploadExpenseReceipt(id: string, file: File): Promise<Result<Expense>> {
  const res = await multipart<Expense>(`/expenses/${encodeURIComponent(id)}/receipt`, file);
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function getExpenseReceiptUrl(id: string): Promise<Result<ReceiptUrl>> {
  return call<ReceiptUrl>(`/expenses/${encodeURIComponent(id)}/receipt-url`);
}

/** Beleg auslesen lassen (Gemini). Speichert nichts — nur Vorschläge. */
export async function extractReceipt(file: File): Promise<Result<ReceiptExtraction>> {
  return multipart<ReceiptExtraction>("/expenses/ocr/extract-receipt", file);
}

export async function runRecurringExpenses(): Promise<Result<RecurringRunResult>> {
  const res = await call<RecurringRunResult>("/expenses/recurring/run", { method: "POST" });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

// --- Kategorien ---------------------------------------------------------------

export async function listExpenseCategories(
  includeInactive = false,
): Promise<Result<ExpenseCategory[]>> {
  return call<ExpenseCategory[]>(
    `/expense-categories${includeInactive ? "?includeInactive=true" : ""}`,
  );
}

export async function createExpenseCategory(
  input: ExpenseCategoryInput,
): Promise<Result<ExpenseCategory>> {
  const res = await call<ExpenseCategory>("/expense-categories", { method: "POST", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function updateExpenseCategory(
  id: string,
  input: Partial<ExpenseCategoryInput>,
): Promise<Result<ExpenseCategory>> {
  const res = await call<ExpenseCategory>(`/expense-categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function deleteExpenseCategory(id: string): Promise<Result<null>> {
  const res = await call<null>(`/expense-categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}
