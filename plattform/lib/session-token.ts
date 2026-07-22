"use server";

// Access-Token des eingeloggten GASTGEBERS für FastAPI-Aufrufe (Bearer).
// Quelle: das FastAPI-Cookie nd_access (HttpOnly, vom /auth/login gesetzt).
// Die Plattform hat KEINE Supabase-OAuth-Welt wie apps/web — nur der eigene
// Login-Flow (E-Mail/Passwort) setzt dieses Cookie. Gast-Buchung bleibt public
// (kein Token). Zwei strikt getrennte Auth-Welten.
import { cookies } from "next/headers";

const ACCESS = "nd_access";

export async function currentToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS)?.value ?? null;
}

// E-Mail des eingeloggten Gastgebers aus dem JWT-`email`-Claim (nur zum
// Vorausfüllen, nie als Vertrauensanker — der Server prüft die Signatur).
export async function currentUserEmail(): Promise<string | null> {
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
