"use server";

// Buchhaltung → Zahlungen / Bank / Kassenbuch: Server-Actions gegen den
// FastAPI-Bereich `bereiche/zahlungen` (/api/v1/buchhaltung/...). Nur async
// functions exportieren ("use server"); Typen liegen in
// buchhaltung-zahlungen-typen.ts. Beträge rechnet ausschließlich das Backend.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

import type {
  BankTransaction,
  BankTransactionFilter,
  BankTransactionInput,
  BankTransactionList,
  BankTransactionUpdate,
  BookingAccount,
  Cashbook,
  CashbookEntryInput,
  CsvImportInput,
  CsvPreview,
  CsvPreviewInput,
  ImportResult,
  PaymentAccount,
  PaymentAccountInput,
  PaymentAccountUpdate,
  Suggestion,
  TransactionLink,
  TransactionLinkInput,
} from "@/lib/buchhaltung-zahlungen-typen";

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

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const PFADE = ["/buchhaltung/zahlungen", "/buchhaltung/bank", "/buchhaltung/kassenbuch"];
function neuLaden(): void {
  for (const p of PFADE) revalidatePath(p);
}

// --- Zahlungskonten -----------------------------------------------------------

export async function listPaymentAccounts(
  includeInactive = false,
): Promise<Result<PaymentAccount[]>> {
  return call<PaymentAccount[]>(`/payment-accounts${query({ includeInactive })}`);
}

export async function createPaymentAccount(
  input: PaymentAccountInput,
): Promise<Result<PaymentAccount>> {
  const res = await call<PaymentAccount>("/payment-accounts", { method: "POST", body: input });
  if (res.ok) neuLaden();
  return res;
}

export async function updatePaymentAccount(
  id: string,
  input: PaymentAccountUpdate,
): Promise<Result<PaymentAccount>> {
  const res = await call<PaymentAccount>(`/payment-accounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) neuLaden();
  return res;
}

export async function deactivatePaymentAccount(id: string): Promise<Result<null>> {
  const res = await call<null>(`/payment-accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (res.ok) neuLaden();
  return res;
}

// --- Bankumsätze ----------------------------------------------------------------

export async function listBankTransactions(
  filter: BankTransactionFilter = {},
): Promise<Result<BankTransactionList>> {
  return call<BankTransactionList>(`/bank-transactions${query(filter)}`);
}

export async function createBankTransaction(
  input: BankTransactionInput,
): Promise<Result<BankTransaction>> {
  const res = await call<BankTransaction>("/bank-transactions", { method: "POST", body: input });
  if (res.ok) neuLaden();
  return res;
}

export async function updateBankTransaction(
  id: string,
  input: BankTransactionUpdate,
): Promise<Result<BankTransaction>> {
  const res = await call<BankTransaction>(`/bank-transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) neuLaden();
  return res;
}

export async function previewCsvImport(input: CsvPreviewInput): Promise<Result<CsvPreview>> {
  return call<CsvPreview>("/bank-transactions/import/preview", { method: "POST", body: input });
}

export async function importCsv(input: CsvImportInput): Promise<Result<ImportResult>> {
  const res = await call<ImportResult>("/bank-transactions/import", {
    method: "POST",
    body: input,
  });
  if (res.ok) neuLaden();
  return res;
}

export async function getSuggestions(transactionId: string): Promise<Result<Suggestion[]>> {
  return call<Suggestion[]>(
    `/bank-transactions/${encodeURIComponent(transactionId)}/suggestions`,
  );
}

// --- Verknüpfungen ----------------------------------------------------------

export async function listTransactionLinks(
  filter: { transactionId?: string; invoiceId?: string; documentId?: string } = {},
): Promise<Result<TransactionLink[]>> {
  return call<TransactionLink[]>(`/transaction-links${query(filter)}`);
}

export async function createTransactionLink(
  input: TransactionLinkInput,
): Promise<Result<TransactionLink>> {
  const res = await call<TransactionLink>("/transaction-links", { method: "POST", body: input });
  if (res.ok) {
    neuLaden();
    revalidatePath("/buchhaltung/rechnungen");
  }
  return res;
}

export async function deleteTransactionLink(id: string): Promise<Result<null>> {
  const res = await call<null>(`/transaction-links/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (res.ok) {
    neuLaden();
    revalidatePath("/buchhaltung/rechnungen");
  }
  return res;
}

// Kontenplan des Bestands (../../router.py `GET /booking-accounts/{company_id}`;
// company_id wird serverseitig ignoriert, der Tenant kommt aus dem JWT).
export async function listBookingAccounts(): Promise<Result<BookingAccount[]>> {
  return call<BookingAccount[]>("/booking-accounts/me");
}

// --- Kassenbuch -------------------------------------------------------------

export async function getCashbook(accountId: string, month: string): Promise<Result<Cashbook>> {
  return call<Cashbook>(`/cashbook${query({ accountId, month })}`);
}

export async function createCashbookEntry(
  input: CashbookEntryInput,
): Promise<Result<BankTransaction>> {
  const res = await call<BankTransaction>("/cashbook/entries", { method: "POST", body: input });
  if (res.ok) neuLaden();
  return res;
}
