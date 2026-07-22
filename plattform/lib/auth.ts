"use server";

// Gastgeber-Auth für die Plattform (eigener Flow, getrennt von web/). Die Cookie-/
// fetch-MECHANIK kommt aus @nextdays/auth (ADR-0017); HIER bleiben die app-
// spezifischen FLOWS + die Cookie-Namen dieser App (nd_access/nd_refresh — dasselbe
// Cookie, das der Proxy als Bearer injiziert). Registrierung setzt
// account_type='marketplace' → 8%-Fee-Modell statt Abo.
import { revalidatePath } from "next/cache";

import {
  api,
  clearSession,
  persistSession,
  readToken,
} from "@nextdays/auth/server";
import { ApiError } from "@nextdays/auth/errors";
import type {
  LoginResponse,
  MeResponse,
  SessionResponse,
} from "@nextdays/auth/types";

export type { SessionResponse, MeResponse };

// Cookie-Namen dieser App (Sicherheitsgrenze — pro App explizit, ADR-0017).
const COOKIES = { access: "nd_access", refresh: "nd_refresh" } as const;

type LoginResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: true; mfaRequired: true; mfaToken: string };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      isPublic: true,
    });
    if (res.mfa_required && res.mfa_token) {
      return { ok: true, mfaRequired: true, mfaToken: res.mfa_token };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, COOKIES);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Login fehlgeschlagen.",
    };
  }
}

export async function loginTotp(
  mfaToken: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await api<LoginResponse>("/auth/login/totp", {
      method: "POST",
      body: { mfa_token: mfaToken, code },
      isPublic: true,
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, COOKIES);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Code ist ungültig.",
    };
  }
}

/** Gastgeber-Registrierung: erzeugt Tenant+Admin mit account_type='marketplace'
 *  (8%-Fee-Modell, KEIN Abo). Meldet direkt an. */
export async function registerHost(input: {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  country: string;
  currency: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await api<SessionResponse>("/auth/register", {
      method: "POST",
      isPublic: true,
      body: {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        tenant_name: input.tenantName,
        country: input.country,
        currency: input.currency,
        // Einzelvermieter, der selbst listet (kein Agentur-Owner-Statement).
        business_type: "self_managed",
        // DAS unterscheidet den Plattform-Gastgeber vom PMS-Betrieb.
        account_type: "marketplace",
      },
    });
    await persistSession(session, COOKIES);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError ? exc.message : "Registrierung fehlgeschlagen.",
    };
  }
}

export async function logout(): Promise<void> {
  await clearSession(COOKIES);
  revalidatePath("/", "layout");
}

export async function getMe(): Promise<MeResponse | null> {
  const token = await readToken(COOKIES.access);
  if (!token) return null;
  try {
    return await api<MeResponse>("/auth/me", { token });
  } catch {
    return null;
  }
}
