"use server";

// Zahlungen (Stripe Connect) — Server-Actions gegen den FastAPI-payments-Slice
// (/api/v1/payments). White-label-Onboarding: das eigene myNextDays-Formular
// sammelt die Geschäfts-/Inhaberdaten und gibt sie hier ans Backend, das sie an
// Stripe weiterreicht (KEIN Stripe-hosted Onboarding). Business-Logik bleibt im
// Backend (PROJECT.md §2). Alle Calls brauchen JWT + Capability MANAGE_BILLING.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/payments${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen ------------------------------------------------------------------

// KYC-Status eines Connect-Custom-Accounts. requirements = offene Felder, die
// Stripe noch zur Freischaltung verlangt; disabled_reason erklärt, warum
// charges/payouts (noch) gesperrt sind.
export type ConnectRequirementError = {
  requirement: string;
  code: string;
  reason: string;
};

export type ConnectStatus = {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  // currently_due — jetzt fällig. Die weiteren Listen kommen getrennt, weil
  // „später fällig" und „in Prüfung" keinen Handlungsbedarf bedeuten.
  requirements: string[];
  past_due: string[];
  eventually_due: string[];
  pending_verification: string[];
  errors: ConnectRequirementError[];
  current_deadline: number | null;
  disabled_reason: string | null;
};

export type CreateConnectAccountInput = {
  email: string;
  country: string;
  tenant_id: string;
};

// Stripe-Account-Update (`fields`): das vom Onboarding-Formular gesammelte
// Geschäfts-/Inhaber-Objekt, 1:1 wie von der Stripe-Account-API erwartet.
export type ConnectAccountFields = {
  business_profile?: {
    url?: string;
    mcc?: string;
    product_description?: string;
  };
  company?: Record<string, unknown>;
  individual?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    dob?: { day: number; month: number; year: number };
    address?: {
      line1?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    };
  };
};

export type BankAccountInput = {
  iban: string;
  accountHolder: string;
  country: string;
};

// --- Gespeicherter Account (aus tenant_billing_profile) ---------------------

// Liest die bereits angelegte stripe_account_id des Tenants ÜBER DIE API (nicht
// mehr per anon-Key direkt aus tenant_billing_profile): die Tabelle ist am anon-/
// authenticated-Direktpfad gesperrt (Wurzel 6, Migration 0169). Der Endpunkt
// läuft über den Server (service_role) und erzwingt den Tenant-Scope. null, wenn
// noch keiner existiert — kein Fallback-/Fantasiewert (Projektregel).
export async function getStoredConnectAccountId(): Promise<string | null> {
  const res = await call<{ stripe_account_id: string | null }>(
    "/connect/account",
  );
  if (!res.ok) return null;
  return res.data.stripe_account_id ?? null;
}

// --- Connect-Account --------------------------------------------------------

// Legt den Custom-Account an. Liefert die neue stripe_account_id.
export async function createConnectAccount(
  input: CreateConnectAccountInput,
): Promise<Result<{ stripe_account_id: string }>> {
  const res = await call<{ stripe_account_id: string }>("/connect/accounts", {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath("/konto");
  return res;
}

// Aktuellen KYC-Status + offene Requirements eines Accounts holen.
export async function getConnectStatus(
  accountId: string,
): Promise<Result<ConnectStatus>> {
  return call<ConnectStatus>(
    `/connect/accounts/${encodeURIComponent(accountId)}`,
  );
}

// --- Diagnose (sichtbares System-/Stripe-Debugging) -------------------------
export type DiagnosticCheck = {
  name: string;
  ok: boolean;
  detail: string;
  duration_ms: number | null;
};

export type StripeAccountDiagnostics = {
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
  currently_due: string[];
  past_due: string[];
  eventually_due: string[];
  pending_verification: string[];
  errors: string[];
};

export type PaymentsDiagnostics = {
  checks: DiagnosticCheck[];
  stripe_account: StripeAccountDiagnostics | null;
};

export async function getPaymentsDiagnostics(): Promise<
  Result<PaymentsDiagnostics>
> {
  return call<PaymentsDiagnostics>("/diagnostics");
}

// Geschäfts-/Inhaberdaten an Stripe übergeben (Account-Update). Gibt den
// aktualisierten Status zurück.
export async function updateConnectAccount(
  accountId: string,
  fields: ConnectAccountFields,
): Promise<Result<ConnectStatus>> {
  const res = await call<ConnectStatus>(
    `/connect/accounts/${encodeURIComponent(accountId)}`,
    { method: "PATCH", body: { fields } },
  );
  if (res.ok) revalidatePath("/konto");
  return res;
}

// Stripe-Nutzungsbedingungen (ToS) mit der echten Request-IP akzeptieren. Stripe
// verlangt diese Annahme zur Freischaltung (charges_enabled). KEIN Body — die IP
// ermittelt das Backend aus dem Request. Gibt den aktualisierten Status zurück.
export async function acceptConnectTos(
  accountId: string,
): Promise<Result<ConnectStatus>> {
  const res = await call<ConnectStatus>(
    `/connect/accounts/${encodeURIComponent(accountId)}/accept-tos`,
    { method: "POST" },
  );
  if (res.ok) revalidatePath("/konto");
  return res;
}

// Auszahlungs-Bankkonto (IBAN) hinterlegen. Gibt den aktualisierten Status zurück.
export async function setBankAccount(
  accountId: string,
  bank: BankAccountInput,
): Promise<Result<ConnectStatus>> {
  const res = await call<ConnectStatus>(
    `/connect/accounts/${encodeURIComponent(accountId)}/bank`,
    {
      method: "PUT",
      body: {
        iban: bank.iban,
        account_holder: bank.accountHolder,
        country: bank.country,
      },
    },
  );
  if (res.ok) revalidatePath("/konto");
  return res;
}

// --- Nachberechnung einer Website-Buchung (0469) -----------------------------
//
// Ein Aufenthalt wird nachträglich teurer (manuelle Verlängerung, Zusatzgast,
// Schaden). Der Gast zahlt die Differenz über einen Stripe-Zahlungslink; der
// Charge läuft im verbundenen Konto des Betriebs und ist provisionsfrei
// (Website-Buchungen laufen nicht über die Plattform). Nur für
// `channel === "website"` — das entscheidet das Backend, nicht die Oberfläche.

export type NachberechnungLink = {
  id: string;
  reservation_id: string;
  /** null bei einer direkt als bezahlt erfassten Nachberechnung (kein Link). */
  url: string | null;
  currency: string;
  amount_cents: number;
  application_fee_cents: number;
  fee_bps: number;
  status: "open" | "paid" | "cancelled" | "refunded" | "partially_refunded";
  grund: string;
  /** true = der Betrieb hat die Zahlung von Hand bestätigt (bar/Überweisung);
   *  false = per Stripe eingegangen. Nur eine manuelle Markierung lässt sich
   *  zurücknehmen. */
  bezahlt_manuell: boolean;
  basis_total_amount: number;
  /** Der Buchungsbetrag hat sich seit Erstellung des Links geändert — der Link
   *  lautet auf einen veralteten Stand und sollte neu erstellt werden. */
  betrag_veraltet: boolean;
  paid_at: string | null;
  created_at: string | null;
  /** Erstattung (0473). Betrag in CENT — der Gast bekommt 100 % dessen, was er
   *  gezahlt hat, und die Zahl muss genau die sein, die Stripe zurückgezahlt hat.
   *  `refunded_at` gesetzt = das Geld ist zurück (nicht bloß storniert). */
  refunded_cents: number;
  refunded_at: string | null;
  refund_reason: string | null;
};

export type NachberechnungStatus = {
  moeglich: boolean;
  hinweis: string | null;
  currency: string;
  offen_amount: number | null;
  vorschlag_amount: number | null;
  link: NachberechnungLink | null;
  /** Bereits bezahlte Nachberechnungen, neueste zuerst. */
  bezahlt: NachberechnungLink[];
};

/** Stand der Nachberechnung: offener Betrag, Vorschlag, offener Link.
 *  Gleicht serverseitig mit Stripe ab, ob inzwischen bezahlt wurde. */
export async function getNachberechnung(
  reservationId: string,
): Promise<Result<NachberechnungStatus>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung`,
  );
}

/** Zahlungslink über eine Nachberechnung erstellen (idempotent: gleicher
 *  Betrag + gleicher Grund geben den bestehenden Link zurück). */
export async function createNachberechnung(
  reservationId: string,
  betrag: number,
  grund: string,
): Promise<Result<NachberechnungLink>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung`,
    { method: "POST", body: { amount: betrag, grund } },
  );
}

/** Den offenen Zahlungslink per E-Mail an den Gast schicken (in seiner Sprache). */
export async function sendNachberechnung(
  reservationId: string,
): Promise<Result<NachberechnungLink>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung/senden`,
    { method: "POST" },
  );
}

/** Offenen Zahlungslink zurückziehen (bei Stripe deaktivieren). */
export async function deleteNachberechnung(
  reservationId: string,
): Promise<Result<null>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung`,
    { method: "DELETE" },
  );
}

/** Den offenen Zahlungslink als bezahlt markieren (Gast hat bar/überwiesen).
 *  Schließt den Link zuerst bei Stripe, damit keine zweite Zahlung möglich ist. */
export async function markNachberechnungBezahlt(
  reservationId: string,
): Promise<Result<NachberechnungLink>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung/bezahlt`,
    { method: "POST" },
  );
}

/** Eine bereits bezahlte Nachberechnung direkt erfassen — ohne Zahlungslink. */
export async function erfasseNachberechnungBezahlt(
  reservationId: string,
  betrag: number,
  grund: string,
): Promise<Result<NachberechnungLink>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung/erfasst`,
    { method: "POST", body: { amount: betrag, grund } },
  );
}

/** Eine fälschlich gesetzte Bezahlt-Markierung zurücknehmen (Grund Pflicht).
 *  Nur bei manuellen Markierungen — eine Stripe-Zahlung wird erstattet. */
export async function nimmNachberechnungZurueck(
  reservationId: string,
  linkId: string,
  grund: string,
): Promise<Result<null>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung/${encodeURIComponent(linkId)}/offen`,
    { method: "POST", body: { grund } },
  );
}

/** Eine per KARTE bezahlte Nachberechnung erstatten (0473, Grund Pflicht).
 *
 *  Das Gegenstück zu `nimmNachberechnungZurueck` und buchhalterisch dessen
 *  Gegenteil: Dort wurde nur ein falscher Haken gesetzt (kein Geld geflossen,
 *  Beleg wird entfernt), hier geht echtes Geld an den Gast zurück und der Beleg
 *  bleibt stehen. Der Server lehnt den jeweils falschen Weg mit 409 ab.
 *
 *  Kein Betragsfeld: Der Gast bekommt immer den vollen Betrag; ein
 *  Client-Betrag wäre eine zweite Wahrheit über eine Geldbewegung. */
export async function erstatteNachberechnung(
  reservationId: string,
  linkId: string,
  grund: string,
): Promise<Result<NachberechnungLink>> {
  return call(
    `/reservations/${encodeURIComponent(reservationId)}/nachberechnung/${encodeURIComponent(linkId)}/erstatten`,
    { method: "POST", body: { grund } },
  );
}
