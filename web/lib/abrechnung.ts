"use server";

// Abrechnung (/konto/abrechnung): Guthaben des verbundenen Stripe-Kontos,
// Auszahlung beantragen, Auszahlungs-Rhythmus wählen — Server-Actions gegen den
// FastAPI-payouts-Slice (/api/v1/payouts). Alles verlangt MANAGE_BILLING.
//
// ZWEI TÖPFE, die nie vermischt werden:
//  * Guthaben bei Stripe — was der Betrieb selbst kassiert hat
//    (Zusatzleistungen, Direktbuchungen als Direct Charge). Liegt auf SEINEM
//    Stripe-Saldo, wird von dort auf sein Bankkonto ausgezahlt.
//  * Plattform-Auszahlungen — Marktplatz-Buchungen (myBestDays), die über
//    unseren Saldo laufen und nach der Abreise transferiert werden.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/payouts${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen ------------------------------------------------------------------

/** Auszahlungs-Rhythmus des verbundenen Kontos. `manual` = nur auf Antrag. */
export type PayoutRhythmus = "manual" | "daily" | "weekly" | "monthly";

export type SaldoPosten = { currency: string; amount_cents: number };

export type StripeAuszahlung = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  /** true = von Stripe nach Rhythmus ausgelöst, false = selbst beantragt. */
  automatic: boolean;
  created: string | null;
  arrival_date: string | null;
  failure_message?: string | null;
};

export type Guthaben = {
  konto_verbunden: boolean;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  /** Leer, solange kein Konto verbunden ist — kein erfundener Standardwert. */
  interval: PayoutRhythmus | "";
  weekly_anchor: string | null;
  monthly_anchor: number | null;
  verfuegbar: SaldoPosten[];
  ausstehend: SaldoPosten[];
  letzte_auszahlungen: StripeAuszahlung[];
};

/** Plattform-Ledger (Marktplatz-Buchungen) — zweite Hälfte der Abrechnung. */
export type PlattformSumme = {
  currency: string;
  pending_amount_cents: number;
  paid_amount_cents: number;
  count: number;
};

export type PlattformZeile = {
  id: string;
  reservation_id: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  donation_cents: number;
  cohost_cents: number;
  net_amount_cents: number;
  currency: string;
  status: string;
  due_at: string;
  paid_at: string | null;
};

export type PlattformPosten = {
  id: string;
  reservation_id: string | null;
  kind: string;
  amount_cents: number;
  settled_cents: number;
  currency: string;
  note: string | null;
  created_at: string;
};

export type PlattformUebersicht = {
  settings: { interval: string; paused: boolean; paused_reason: string | null };
  summary: PlattformSumme[];
  recent: PlattformZeile[];
  adjustments: PlattformPosten[];
};

// --- Aufrufe ----------------------------------------------------------------

/** Saldo (verfügbar/ausstehend), Rhythmus und die letzten Auszahlungen. */
export async function getGuthaben(): Promise<Result<Guthaben>> {
  return call("/guthaben");
}

/** Auszahlung beantragen. Ohne Betrag: das gesamte verfügbare Guthaben der
 *  Währung. Der Server prüft Deckung, Freischaltung und Rhythmus. */
export async function auszahlungAnfordern(
  currency: string,
  amountCents?: number,
): Promise<Result<StripeAuszahlung>> {
  return call("/guthaben/auszahlung", {
    method: "POST",
    body: { currency, amount_cents: amountCents ?? null },
  });
}

/** Auszahlungs-Rhythmus wählen (die Entscheidung trifft der Betrieb selbst). */
export async function rhythmusSetzen(
  interval: PayoutRhythmus,
  opts: { weeklyAnchor?: string; monthlyAnchor?: number } = {},
): Promise<Result<Guthaben>> {
  return call("/guthaben/rhythmus", {
    method: "PUT",
    body: {
      interval,
      weekly_anchor: opts.weeklyAnchor ?? null,
      monthly_anchor: opts.monthlyAnchor ?? null,
    },
  });
}

/** Plattform-Auszahlungen (Marktplatz-Buchungen über unseren Saldo). */
export async function getPlattformAuszahlungen(): Promise<
  Result<PlattformUebersicht>
> {
  return call("");
}
