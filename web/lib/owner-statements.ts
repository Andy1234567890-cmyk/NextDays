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
  /** Gast-Mieteinnahmen (Brutto). `null` = maskiert: der Eigentümer sieht
   *  seine Auszahlung, nicht den Verkaufspreis des Gastes (§4.2). Als „—"
   *  rendern, NIE als 0 (Wurzel 4). */
  total_price: number | null;
  total_payout: number;
  /** Netto-Wirkung der Verrechnungsposten: Σ(zugunsten) − Σ(zulasten). */
  expenses_total: number;
  /** Die beiden Richtungen einzeln — eine Nettozahl allein verbirgt, dass
   *  Kompensation und Material gegeneinander stehen. */
  expenses_to_owner: number;
  expenses_from_owner: number;
  /** `null` = nicht berechenbar, weil für mindestens ein Objekt KEIN
   *  Provisionssatz hinterlegt ist (`payout_unbekannt` nennt den Grund).
   *  Als „—" rendern, NIE als 0 — eine 0 läse sich als „dem Eigentümer steht
   *  nichts zu", während in Wahrheit nur der Satz fehlt (Wurzel 4). */
  owner_payout: number | null;
  /** Ertrag der VERWALTUNG. `null` = maskiert (§4.2) — für den Eigentümer
   *  gehört diese Zahl nicht in seine Abrechnung — ODER nicht berechenbar
   *  (siehe `owner_payout`). */
  pm_payout: number | null;
  currency: string;
  booking_count: number;
  // Owner-Zielwährung (aus Herkunftsland); owner_payout ist in DIESER Währung.
  owner_currency: string;
  // Verwaltungs-Auszahlung + Roh-Summen je Quellwährung (keine Mischsumme).
  pm_payout_by_currency: CurrencyAmount[];
  totals_by_currency: CurrencyAmount[];
  /** Warum die Auszahlungs-Zahlen fehlen — heute nur `"provision"` (kein Satz
   *  hinterlegt). Die Maske macht daraus den Hinweis, WAS zu tun ist. */
  payout_unbekannt: string | null;
};

export type RentalRow = {
  reservation_id: string;
  guest: string | null;
  nights: number;
  listing_id: string;
  listing: string | null;
  channel: string;
  /** Gast-Bruttopreis der Buchung. `null` = maskiert (§4.2). */
  total_price: number | null;
  total_payout: number;
  // Quellwährung der Buchung + Owner-Auszahlung (Buchungssatz) in Quell- und
  // Owner-Währung samt verwendetem Tageskurs/Stichtag.
  currency: string;
  /** `null` = für dieses Objekt steht kein Provisionssatz fest (siehe
   *  `payout_unbekannt`). Als „—" rendern, nie als 0. */
  owner_payout: number | null;
  owner_payout_converted: number | null;
  fx_rate: number;
  fx_date: string | null;
  /** Grund für eine fehlende Auszahlung dieser Zeile — heute `"provision"`. */
  payout_unbekannt: string | null;
};

export type ListingRow = {
  listing_id: string;
  listing: string | null;
  nights: number;
  reservations: number;
  /** Gast-Bruttopreis je Objekt. `null` = maskiert (§4.2). */
  total_price: number | null;
  total_payout: number;
};

/** Richtung eines Verrechnungspostens — die Fachfrage, nicht ein Vorzeichen.
 *  `to_owner`   zugunsten des Eigentümers (erhöht seine Auszahlung, z. B.
 *               Schadenskompensation).
 *  `from_owner` zulasten des Eigentümers (mindert sie, z. B. Material/
 *               Arbeitszeit des Betriebs).
 *  Der Betrag ist in BEIDEN Fällen positiv. */
export type ExpenseDirection = "to_owner" | "from_owner";

export type Expense = {
  id: string;
  tenant_id: string;
  statement_id: string | null;
  concept: string;
  date: string;
  direction: ExpenseDirection;
  category: string | null;
  listing_id: string | null;
  reservation_id: string | null;
  owner_id: string | null;
  /** Immer positiv. Für die Wirkung auf die Auszahlung `signed_amount` nehmen. */
  amount: number;
  /** Wirkbetrag auf die Auszahlung: +amount bzw. −amount. Vom Server abgeleitet
   *  — nie im Frontend aus `direction` neu berechnen (eine Wahrheit). */
  signed_amount: number;
  /** Währung des Postens (aus Objekt/Betrieb). Leer heißt Datenfehler — dann
   *  symbollos rendern, nie ein EUR erfinden (Wurzel 4). */
  currency: string | null;
  attachment_url: string | null;
  hidden_from_owner: boolean;
  /** Nachvollziehbarkeit: wer hat den Posten angelegt. */
  created_by: string | null;
  created_by_name: string | null;
  /** Beleg im privaten Bucket — Download nur über signierte URL. */
  file_name: string | null;
  has_receipt: boolean;
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
  /** `null` = kein Provisionssatz vereinbart (weder je Objekt noch als
   *  Owner-Standard). Als „—" rendern, nie als 0 % (Wurzel 4). */
  commission_pct: number | null;
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
  /** `null` = nicht berechenbar (kein Provisionssatz), siehe
   *  `StatementSummary.owner_payout`. Als „—" rendern, nie als 0. */
  owner_payout: number | null;
  /** Ertrag der Verwaltung. `null` = maskiert (§4.2). */
  pm_payout: number | null;
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

/** Verrechnungsposten anlegen. `direction` ist Pflicht (zugunsten/zulasten),
 *  `amount` immer positiv — das Backend lehnt 0/negativ mit 422 ab. */
export async function addExpense(input: {
  statement_id?: string | null;
  concept: string;
  date: string;
  direction: ExpenseDirection;
  category?: string | null;
  listing_id?: string | null;
  reservation_id?: string | null;
  owner_id?: string | null;
  amount: number;
  currency?: string | null;
  attachment_url?: string | null;
  hidden_from_owner?: boolean;
}): Promise<Result<Expense>> {
  return call("/owner-statements/expenses", { method: "POST", body: input });
}

export async function updateExpense(
  id: string,
  input: Partial<
    Omit<
      Expense,
      | "id"
      | "tenant_id"
      | "signed_amount"
      | "created_by"
      | "created_by_name"
      | "file_name"
      | "has_receipt"
      | "created_at"
      | "updated_at"
    >
  >,
): Promise<Result<Expense>> {
  return call(`/owner-statements/expenses/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteExpense(id: string): Promise<Result<null>> {
  return call(`/owner-statements/expenses/${id}`, { method: "DELETE" });
}

/** Beleg (PDF/Bild) an einen Verrechnungsposten hängen. Landet im privaten
 *  Bucket; der Dateityp wird serverseitig an den Magic-Bytes geprüft.
 *
 *  Eigener `fetch` statt `call()`: der JSON-Helfer stringifiziert jeden Body
 *  und setzt Content-Type: application/json — multipart bräche daran. Gleiches
 *  Muster wie `uploadAddonMedia`. */
export async function uploadExpenseReceipt(
  id: string,
  file: File,
): Promise<Result<Expense>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(
      `${base}/api/v1/owner-statements/expenses/${id}/receipt`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as Expense };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Signierte, zeitlich begrenzte Download-URL für den Beleg. */
export async function expenseReceiptUrl(
  id: string,
): Promise<Result<{ url: string; expires_in: number }>> {
  return call(`/owner-statements/expenses/${id}/receipt`);
}
