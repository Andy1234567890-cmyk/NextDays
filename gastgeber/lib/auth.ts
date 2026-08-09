"use server";

// Gastgeber-Auth als Server Actions (Cookie SETZEN geht nur hier, nicht in Server
// Components — ADR-0015). Die Cookie-/fetch-MECHANIK kommt aus @nextdays/auth
// (ADR-0017); HIER bleiben die app-spezifischen FLOWS (Login/TOTP/Register mit
// account_type='marketplace') + die Cookie-Namen der Gastgeber-Welt.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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
  | {
      ok: true;
      mfaRequired: true;
      mfaToken: string;
      // Welche 2. Faktoren zur Auswahl stehen ('totp' und/oder 'sms').
      mfaMethods: string[];
      // Maskierte Zielnummer, falls SMS ein Faktor ist (sonst null).
      mfaPhoneMasked: string | null;
    }
  | { ok: false; error: string };

/** Echter Browser-Kontext (User-Agent + IP) des eingehenden Requests. Wird beim
 *  Login mitgegeben, damit der Geräteverlauf echtes Gerät + echte IP zeigt.
 *  Die IP steht in x-forwarded-for (Traefik/Prod) bzw. x-real-ip; lokal fehlt sie
 *  → undefined, das Backend fällt dann auf seine Peer-IP zurück (kein Fake). */
async function browserContext(): Promise<{
  clientUserAgent?: string;
  clientIp?: string;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  return {
    clientUserAgent: h.get("user-agent") ?? undefined,
    clientIp: ip,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      public: true,
      ...(await browserContext()),
    });
    if (res.mfa_required && res.mfa_token) {
      return {
        ok: true,
        mfaRequired: true,
        mfaToken: res.mfa_token,
        mfaMethods: res.mfa_methods ?? [],
        mfaPhoneMasked: res.mfa_phone_masked ?? null,
      };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, HOST_COOKIES);
    return { ok: true };
  } catch (exc) {
    // Kein stiller Ersatztext (Wurzel 5): ist es KEIN ApiError (also ein echter
    // Laufzeitfehler statt einer Backend-Ablehnung), die wahre Ursache in den
    // Server-Log schreiben und im UI benennen — nicht als „Login fehlgeschlagen"
    // tarnen (das würde einen Konfig-/Code-Fehler wie falsche Zugangsdaten aussehen lassen).
    if (exc instanceof ApiError) return { ok: false, error: exc.message };
    console.error("host_login_unexpected_error", exc);
    return {
      ok: false,
      error: `Unerwarteter Fehler beim Login: ${exc instanceof Error ? exc.message : String(exc)}`,
    };
  }
}

/** Meldung bei einer STÖRUNG (5xx / Dienst nicht erreichbar).
 *
 * Wurzel 5: Ein Ausfall darf nie wie eine Ablehnung aussehen. „Code ist
 * ungültig." bei einem GoTrue-Ausfall schickt den Nutzer den zweiten Faktor
 * endlos neu eingeben, obwohl sein Code stimmt. */
const STOERUNG_MELDUNG =
  "Anmeldedienst derzeit nicht erreichbar. Das liegt nicht an deinem Code — " +
  "bitte später erneut versuchen.";

/** Störung (→ ehrliche Meldung) statt Ablehnung? Alles, was kein ApiError ist
 *  (Transportfehler), plus jeder 5xx. Nur 4xx ist ein echtes Urteil. */
function istStoerung(exc: unknown): boolean {
  return !(exc instanceof ApiError) || exc.status >= 500;
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
      ...(await browserContext()),
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, HOST_COOKIES);
    return { ok: true };
  } catch (exc) {
    if (istStoerung(exc)) return { ok: false, error: STOERUNG_MELDUNG };
    return { ok: false, error: (exc as ApiError).message };
  }
}

/** Zweiter Login-Schritt bei SMS-2FA: mfa_token + 6-stelliger SMS-Code gegen
 *  eine echte Session einlösen. Der Code kam per SMS aus dem ersten login()-Schritt. */
export async function loginSms(
  mfaToken: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await api<LoginResponse>("/auth/login/sms", {
      method: "POST",
      body: { mfa_token: mfaToken, code },
      public: true,
      ...(await browserContext()),
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, HOST_COOKIES);
    return { ok: true };
  } catch (exc) {
    if (istStoerung(exc)) return { ok: false, error: STOERUNG_MELDUNG };
    return { ok: false, error: (exc as ApiError).message };
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
