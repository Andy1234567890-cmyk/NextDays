"use server";

// Kontenplan (Buchhaltung): Server-Actions gegen den Bereich »kontenplan«
// (/api/v1/buchhaltung/{booking-accounts,cost-centers,payment-methods,
// number-sequences}). Nur async functions — Typen liegen in
// lib/buchhaltung-kontenplan-typen.ts ("use server" verträgt keine Werte).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  BookingAccount,
  BookingAccountInput,
  CostCenter,
  CostCenterInput,
  CreateDefaultsResult,
  ImportStandardResult,
  Kontenrahmen,
  NumberSequence,
  NumberSequenceInput,
  PaymentMethod,
  PaymentMethodInput,
} from "@/lib/buchhaltung-kontenplan-typen";
import { currentToken } from "@/lib/session-token";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

const SEITE = "/buchhaltung/kontenplan";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
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

async function nachAktion<T>(res: Result<T>): Promise<Result<T>> {
  if (res.ok) revalidatePath(SEITE);
  return res;
}

// --- Buchungskonten ---------------------------------------------------------

export async function listBookingAccounts(): Promise<Result<BookingAccount[]>> {
  return call<BookingAccount[]>("/booking-accounts");
}

export async function createBookingAccount(
  input: BookingAccountInput,
): Promise<Result<BookingAccount>> {
  return nachAktion(await call<BookingAccount>("/booking-accounts", { method: "POST", body: input }));
}

export async function updateBookingAccount(
  id: string,
  input: Partial<BookingAccountInput>,
): Promise<Result<BookingAccount>> {
  return nachAktion(
    await call<BookingAccount>(`/booking-accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function deleteBookingAccount(id: string): Promise<Result<null>> {
  return nachAktion(
    await call<null>(`/booking-accounts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

export async function importStandardAccounts(
  kontenrahmen: Kontenrahmen,
): Promise<Result<ImportStandardResult>> {
  return nachAktion(
    await call<ImportStandardResult>(
      `/booking-accounts/import-standard?kontenrahmen=${encodeURIComponent(kontenrahmen)}`,
      { method: "POST" },
    ),
  );
}

// --- Kostenstellen -----------------------------------------------------------

export async function listCostCenters(): Promise<Result<CostCenter[]>> {
  return call<CostCenter[]>("/cost-centers");
}

export async function createCostCenter(input: CostCenterInput): Promise<Result<CostCenter>> {
  return nachAktion(await call<CostCenter>("/cost-centers", { method: "POST", body: input }));
}

export async function updateCostCenter(
  id: string,
  input: Partial<CostCenterInput>,
): Promise<Result<CostCenter>> {
  return nachAktion(
    await call<CostCenter>(`/cost-centers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function deleteCostCenter(id: string): Promise<Result<null>> {
  return nachAktion(
    await call<null>(`/cost-centers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

// --- Zahlungsarten -----------------------------------------------------------

export async function listPaymentMethods(): Promise<Result<PaymentMethod[]>> {
  return call<PaymentMethod[]>("/payment-methods");
}

export async function createPaymentMethod(
  input: PaymentMethodInput,
): Promise<Result<PaymentMethod>> {
  return nachAktion(await call<PaymentMethod>("/payment-methods", { method: "POST", body: input }));
}

export async function updatePaymentMethod(
  id: string,
  input: Partial<PaymentMethodInput>,
): Promise<Result<PaymentMethod>> {
  return nachAktion(
    await call<PaymentMethod>(`/payment-methods/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function deletePaymentMethod(id: string): Promise<Result<null>> {
  return nachAktion(
    await call<null>(`/payment-methods/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

// --- Nummernkreise -----------------------------------------------------------

/** Vorschau über den BESTEHENDEN, nicht-inkrementierenden GET (GoBD: kein „next"). */
export async function listNumberSequences(): Promise<Result<NumberSequence[]>> {
  return call<NumberSequence[]>("/number-sequences");
}

export async function updateNumberSequence(
  sequence: string,
  input: NumberSequenceInput,
): Promise<Result<NumberSequence>> {
  return nachAktion(
    await call<NumberSequence>(`/number-sequences/${encodeURIComponent(sequence)}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function createDefaultSequences(): Promise<Result<CreateDefaultsResult>> {
  return nachAktion(
    await call<CreateDefaultsResult>("/number-sequences/create-defaults", { method: "POST" }),
  );
}
