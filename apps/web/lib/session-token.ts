"use server";

// Liefert das Access-Token des eingeloggten Nutzers für FastAPI-Aufrufe.
// Quelle: FastAPI-Cookie nd_access ODER Supabase-OAuth-Session (Google).
// getUser() zuerst validiert/erneuert die Session serverseitig (@supabase/ssr).
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

const ACCESS = "nd_access";

export async function currentToken(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(ACCESS)?.value;
  if (fromCookie) return fromCookie;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// E-Mail des eingeloggten Nutzers (Login-/Konto-E-Mail). Quelle: Supabase-User
// oder der `email`-Claim im FastAPI-JWT (nd_access). Dient nur zum Vorausfüllen
// der Rechnungs-/Firmen-E-Mail im Onboarding.
export async function currentUserEmail(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) return user.email;
  } catch {
    // ignorieren — Fallback auf JWT
  }

  const jar = await cookies();
  const token = jar.get(ACCESS)?.value;
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const claims = JSON.parse(json) as { email?: string };
    return claims.email ?? null;
  } catch {
    return null;
  }
}
