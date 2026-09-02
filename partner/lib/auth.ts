"use server";

// Partner-Auth als Server Actions (Cookie SETZEN geht nur hier). Die Cookie-/
// fetch-Mechanik kommt aus @nextdays/auth (ADR-0017); HIER bleiben die Flows
// der Partner-Welt: Bewerbung, Login, Logout, Refresh.
import type { SocialKanal } from "./kanaele";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@nextdays/auth/errors";
import { clearSession, persistSession, readToken } from "@nextdays/auth/server";
import type { SessionResponse } from "@nextdays/auth/types";

import { PARTNER_COOKIES, api } from "./api-server";

export type Ergebnis = { ok: true } | { ok: false; fehler: string; status?: number };

const STOERUNG = "service_unavailable";

function istStoerung(exc: unknown): boolean {
  return !(exc instanceof ApiError) || exc.status >= 500;
}

async function browserContext(): Promise<{ clientUserAgent?: string; clientIp?: string }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    clientUserAgent: h.get("user-agent") ?? undefined,
    clientIp: forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
  };
}

export async function anmelden(email: string, password: string): Promise<Ergebnis> {
  try {
    const session = await api<SessionResponse>("/affiliates/auth/login", {
      method: "POST",
      body: { email, password },
      isPublic: true,
      ...(await browserContext()),
    });
    await persistSession(session, PARTNER_COOKIES);
    return { ok: true };
  } catch (exc) {
    if (istStoerung(exc)) return { ok: false, fehler: STOERUNG, status: 503 };
    const e = exc as ApiError;
    return { ok: false, fehler: e.message, status: e.status };
  }
}

export type Bewerbung = {
  email: string;
  password: string;
  full_name: string;
  company: string | null;
  legal_form: "company" | "private";
  country: string;
  vat_id: string | null;
  language: string;
  channel_url: string | null;
  channels: SocialKanal[];
  sponsor_code: string | null;
  pitch: string | null;
  terms_accepted: boolean;
  terms_version: string;
  captcha_token: string | null;
  website: string | null;
};

export async function bewerben(daten: Bewerbung): Promise<Ergebnis> {
  try {
    const session = await api<SessionResponse>("/affiliates/apply", {
      method: "POST",
      body: daten,
      isPublic: true,
      ...(await browserContext()),
    });
    await persistSession(session, PARTNER_COOKIES);
    return { ok: true };
  } catch (exc) {
    if (istStoerung(exc)) return { ok: false, fehler: STOERUNG, status: 503 };
    const e = exc as ApiError;
    return { ok: false, fehler: e.message, status: e.status };
  }
}

export async function passwortVergessen(email: string): Promise<Ergebnis> {
  try {
    await api("/affiliates/auth/password-reset", {
      method: "POST",
      body: { email },
      isPublic: true,
    });
    return { ok: true };
  } catch {
    return { ok: false, fehler: STOERUNG, status: 503 };
  }
}

/** Frische Session aus dem Refresh-Cookie. false = nicht möglich (abgemeldet). */
export async function sitzungErneuern(): Promise<boolean> {
  const refresh = await readToken(PARTNER_COOKIES.refresh);
  if (!refresh) return false;
  try {
    const session = await api<SessionResponse>("/affiliates/auth/refresh", {
      method: "POST",
      body: { refresh_token: refresh },
      isPublic: true,
    });
    await persistSession(session, PARTNER_COOKIES);
    return true;
  } catch {
    return false;
  }
}

export async function abmelden(): Promise<never> {
  await clearSession(PARTNER_COOKIES);
  redirect("/anmelden");
}
