"use server";

// Liefert das Access-Token des eingeloggten Nutzers für FastAPI-Aufrufe.
// Quelle: FastAPI-Cookie nd_access ODER Supabase-OAuth-Session (Google).
// getUser() zuerst validiert/erneuert die Session serverseitig (@supabase/ssr).
// Cookie-Read + JWT-email-Decoder aus @nextdays/auth (ADR-0017); die
// Supabase-OAuth-Welt bleibt web-spezifisch (nur web hat Google-Login).
import { emailFromToken, readToken } from "@nextdays/auth/server";

import { createClient } from "@/lib/supabase/server";

const ACCESS = "nd_access";

export async function currentToken(): Promise<string | null> {
  const fromCookie = await readToken(ACCESS);
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

  const token = await readToken(ACCESS);
  if (!token) return null;
  return emailFromToken(token);
}
