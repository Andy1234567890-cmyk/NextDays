"use server";

// Access-Token + Login-E-Mail des eingeloggten Gastgebers (Bearer für FastAPI).
// Quelle: das Cookie nd_access (vom eigenen /auth/login gesetzt). Die Plattform
// hat KEINE Supabase-OAuth-Welt wie web/ — nur der eigene E-Mail/Passwort-Flow.
// Gast-Buchung bleibt public (kein Token). Mechanik aus @nextdays/auth (ADR-0017).
import { emailFromToken, readToken } from "@nextdays/auth/server";

const ACCESS = "nd_access";

export async function currentToken(): Promise<string | null> {
  return readToken(ACCESS);
}

// E-Mail aus dem JWT-`email`-Claim (nur zum Vorausfüllen, nie Vertrauensanker).
export async function currentUserEmail(): Promise<string | null> {
  const token = await readToken(ACCESS);
  if (!token) return null;
  return emailFromToken(token);
}
