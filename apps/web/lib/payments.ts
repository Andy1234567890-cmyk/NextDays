"use server";

// Zahlungen (Stripe Connect) — Server-Actions gegen den FastAPI-payments-Slice
// (/api/v1/payments). White-label-Onboarding: das eigene myNextDays-Formular
// sammelt die Geschäfts-/Inhaberdaten und gibt sie hier ans Backend, das sie an
// Stripe weiterreicht (KEIN Stripe-hosted Onboarding). Business-Logik bleibt im
// Backend (PROJECT.md §2). Alle Calls brauchen JWT + Capability MANAGE_BILLING.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
export type ConnectStatus = {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements: string[];
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

// Liest die bereits angelegte stripe_account_id des Tenants direkt aus
// tenant_billing_profile (vom account.updated-Webhook gespiegelt — dieselbe
// Quelle, die das Realtime-Abo beobachtet). RLS-scoped: der Supabase-Client wird
// mit dem echten App-Token authentifiziert (wie in use-realtime.ts), sonst liefe
// die Query als anon und RLS gäbe nichts zurück. null, wenn noch keiner existiert
// — kein Fallback-/Fantasiewert (Projektregel).
export async function getStoredConnectAccountId(): Promise<string | null> {
  const token = await currentToken();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const supabase = createSupabaseClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("tenant_billing_profile")
    .select("stripe_account_id")
    .not("stripe_account_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const id = (data as { stripe_account_id: string | null }).stripe_account_id;
  return id ?? null;
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
