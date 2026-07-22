"use server";

// Gastgeber-Auth als Server Actions (Cookie SETZEN geht nur hier, nicht in Server
// Components — ADR-0015). Die Cookie-/fetch-MECHANIK kommt aus @nextdays/auth
// (ADR-0017); HIER bleiben die app-spezifischen FLOWS (Login/TOTP/Register mit
// account_type='marketplace') + die Cookie-Namen der Gastgeber-Welt.
import { revalidatePath } from "next/cache";

import { clearSession, persistSession } from "@nextdays/auth/server";
import type {
  LoginResponse,
  MeResponse,
  SessionResponse,
} from "@nextdays/auth/types";

import { ApiError, api, HOST_COOKIES } from "./api-server";

export type { MeResponse };

type LoginResult =
  | { ok: true; mfaRequired?: false }
  | { ok: true; mfaRequired: true; mfaToken: string }
  | { ok: false; error: string };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      public: true,
    });
    if (res.mfa_required && res.mfa_token) {
      return { ok: true, mfaRequired: true, mfaToken: res.mfa_token };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, HOST_COOKIES);
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
      public: true,
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, HOST_COOKIES);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Code ist ungültig.",
    };
  }
}

/** Gastgeber-Registrierung: Tenant+Admin mit account_type='marketplace'
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
      public: true,
      body: {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        tenant_name: input.tenantName,
        country: input.country,
        currency: input.currency,
        business_type: "self_managed",
        account_type: "marketplace",
      },
    });
    await persistSession(session, HOST_COOKIES);
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
  await clearSession(HOST_COOKIES);
  revalidatePath("/", "layout");
}
