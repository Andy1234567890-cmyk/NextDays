"use server";

// Buchungs-Konditionen (Zahlungsplan/Storno/Kaution) — Server-Actions gegen den
// booking_conditions-Slice. Sensible Finanzdaten: nur mit gültigem Token, der
// Server erzwingt zusätzlich die Berechtigung (manage_property_conditions).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

// Eine gestaffelte Storno-Regel: X % erstattet bei ≥ Y Tage vor Anreise.
export type RefundRule = {
  refund_percent: number;
  days_before_arrival: number;
};

export type Installments = 1 | 2 | 3;
export type PaymentTiming = "on_booking" | "days_before_arrival";
export type AmountType = "percent" | "absolute";
export type BalanceTiming =
  | "days_before_arrival"
  | "days_after_arrival"
  | "days_before_departure"
  | "not_scheduled";
export type CancellationMode = "non_refundable" | "refundable" | "partial";
export type DepositMethod = "preauth" | "manual";

export type BookingCondition = {
  id: string;
  tenant_id: string;
  internal_name: string;
  is_default: boolean;
  // Zahlungsplan
  installments: Installments;
  first_payment_amount_type: AmountType;
  first_payment_percent: number | null;
  first_payment_timing: PaymentTiming;
  first_payment_days: number | null;
  balance_timing: BalanceTiming;
  balance_days_before_arrival: number | null;
  third_payment_percent: number | null;
  third_payment_days_before: number | null;
  // Stornierung
  cancellation_mode: CancellationMode;
  refund_rules: RefundRule[];
  // Kaution
  deposit_required: boolean;
  deposit_method: DepositMethod;
  deposit_amount_type: "absolute" | "percent";
  deposit_amount: number | null;
  deposit_currency: string | null;
  preauth_days_before_arrival: number | null;
  release_days_after_departure: number | null;
  // Angebots-Gültigkeit
  quote_validity_hours: number | null;
};

// Alle Felder außer id/tenant_id sind beim Erstellen/Ändern setzbar.
export type BookingConditionInput = Omit<BookingCondition, "id" | "tenant_id">;

const BASE = "/booking-conditions";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
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

export async function listBookingConditions(): Promise<
  Result<BookingCondition[]>
> {
  return call<BookingCondition[]>(BASE);
}

export async function createBookingCondition(
  input: BookingConditionInput,
): Promise<Result<BookingCondition>> {
  return call<BookingCondition>(BASE, { method: "POST", body: input });
}

export async function updateBookingCondition(
  id: string,
  input: BookingConditionInput,
): Promise<Result<BookingCondition>> {
  return call<BookingCondition>(`${BASE}/${id}`, { method: "PUT", body: input });
}

export async function deleteBookingCondition(id: string): Promise<Result<null>> {
  return call<null>(`${BASE}/${id}`, { method: "DELETE" });
}

export async function setDefaultBookingCondition(
  id: string,
): Promise<Result<BookingCondition>> {
  return call<BookingCondition>(`${BASE}/${id}/default`, { method: "POST" });
}
