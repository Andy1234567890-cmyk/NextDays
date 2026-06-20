"use server";

// Auth-Server-Actions: rufen das FastAPI-Backend (auth-Slice) und verwalten die
// Session über httpOnly-Cookies. Die Business-Logik bleibt in FastAPI
// (PROJECT.md §2) — hier wird nur aufgerufen und das Token sicher abgelegt.
import { cookies } from "next/headers";

import { ApiError, api, type MeResponse, type SessionResponse } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import { createClient } from "@/lib/supabase/server";

const ACCESS = "nd_access";
const REFRESH = "nd_refresh";

/** Login: FastAPI prüft die Zugangsdaten, wir legen die Tokens als httpOnly ab. */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await api<SessionResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    const jar = await cookies();
    const secure = process.env.NODE_ENV === "production";
    jar.set(ACCESS, session.access_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: session.expires_in,
    });
    jar.set(REFRESH, session.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    });
    return { ok: true };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Login fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Logout: beide Session-Arten beenden (FastAPI-Cookies + Supabase-Session). */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);

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
