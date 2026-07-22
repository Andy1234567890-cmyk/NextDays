"use server";

// Auth-Server-Actions: rufen das FastAPI-Backend (auth-Slice) und verwalten die
// Session über httpOnly-Cookies. Die Business-Logik bleibt in FastAPI
// (PROJECT.md §2) — hier wird nur aufgerufen und das Token sicher abgelegt.
import { revalidatePath } from "next/cache";

import { clearSession, persistSession } from "@nextdays/auth/server";
import type { LoginResponse } from "@nextdays/auth/types";

import { ApiError, api, type MeResponse, type SessionResponse } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import { createClient } from "@/lib/supabase/server";

// Cookie-Namen dieser App (Sicherheitsgrenze — pro App explizit, ADR-0017). web
// nutzt zusätzlich eine Supabase-OAuth-Welt (Google), die hier web-lokal bleibt.
const COOKIES = { access: "nd_access", refresh: "nd_refresh" } as const;

type LoginResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: true; mfaRequired: true; mfaToken: string };

/** Login-Schritt 1: E-Mail + Passwort. Bei aktivem 2FA kommt KEINE Session,
 *  sondern mfaRequired + mfaToken — die UI fragt dann den Code ab. */
export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (res.mfa_required && res.mfa_token) {
      return { ok: true, mfaRequired: true, mfaToken: res.mfa_token };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, COOKIES);
    return { ok: true };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Login fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Login-Schritt 2 (nur bei aktivem 2FA): mfaToken + TOTP-/Recovery-Code gegen
 *  eine Session einlösen. */
export async function loginTotp(
  mfaToken: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await api<LoginResponse>("/auth/login/totp", {
      method: "POST",
      body: { mfa_token: mfaToken, code },
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, COOKIES);
    return { ok: true };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Code ist ungültig.";
    return { ok: false, error };
  }
}

/** Registrierung: legt im Backend Tenant + Owner an und meldet direkt an.
 *  Setzt dieselben httpOnly-Cookies wie login (das Backend gibt eine Session
 *  zurück). Business-Logik (Tenant/Owner/Channel-Manager-Group) bleibt in
 *  FastAPI (auth.register). */
export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  country: string;
  currency: string;
  businessType?: "agency" | "self_managed";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await api<SessionResponse>("/auth/register", {
      method: "POST",
      body: {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        tenant_name: input.tenantName,
        country: input.country,
        currency: input.currency,
        business_type: input.businessType ?? "agency",
      },
    });
    await persistSession(session, COOKIES);
    return { ok: true };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Registrierung fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Logout: beide Session-Arten beenden (FastAPI-Cookies + Supabase-Session). */
export async function logout(): Promise<void> {
  await clearSession(COOKIES);

  // Supabase-OAuth-Session (z. B. Google) ebenfalls beenden — ignoriert, wenn
  // gar keine Supabase-Session existiert.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // keine Supabase-Session vorhanden — unkritisch
  }
}

/** Aktuellen Nutzer aus FastAPI holen (null, wenn nicht eingeloggt).
 *  Nutzt currentToken() → funktioniert für BEIDE Login-Wege: FastAPI-Cookie
 *  (nd_access) UND Supabase-OAuth-Session (Google). So kommen Rolle +
 *  Berechtigungen auch bei OAuth in die Sidebar (UI-Gating). */
export async function getMe(): Promise<MeResponse | null> {
  const token = await currentToken();
  if (!token) return null;
  try {
    return await api<MeResponse>("/auth/me", { token });
  } catch {
    return null;
  }
}

/** Beherbergungsart des Mandanten umstellen (nur Admin, Capability
 *  manage_tenant). Steuert die Dashboard-Navigation (FeWo vs. Hotel). */
export async function setAccommodationType(
  value: "vacation_rental" | "hotel",
): Promise<{ ok: true; data: MeResponse } | { ok: false; error: string }> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<MeResponse>("/auth/tenant/accommodation-type", {
      token,
      method: "PATCH",
      body: { accommodation_type: value },
    });
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : "Unbekannter Fehler." };
  }
}
