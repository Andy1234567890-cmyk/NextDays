"use server";

// OAuth-Consent-Server-Action: reicht die Zustimmungs-Entscheidung des Nutzers
// an FastAPI weiter, das den Supabase-OAuth-Server aufruft. Frontend trägt keine
// Logik (PROJECT.md §2) — es leitet nur die Entscheidung + Session weiter.
import { cookies } from "next/headers";

import { ApiError, api } from "@/lib/api";

const ACCESS = "nd_access";

type ConsentResult =
  | { ok: true; redirect_url: string }
  | { ok: false; error: string };

/**
 * Zustimmung oder Ablehnung an FastAPI senden. Das Backend bestätigt die
 * Autorisierung beim Supabase-OAuth-Server und gibt die Weiterleitungs-URL
 * (zurück zur Drittanbieter-App, inkl. code/state) zurück.
 */
export async function decideConsent(
  authorizationId: string,
  approve: boolean,
): Promise<ConsentResult> {
  const jar = await cookies();
  const token = jar.get(ACCESS)?.value;
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  try {
    const res = await api<{ redirect_url: string }>("/auth/oauth/consent", {
      method: "POST",
      token,
      body: { authorization_id: authorizationId, approve },
    });
    return { ok: true, redirect_url: res.redirect_url };
  } catch (exc) {
    const error =
      exc instanceof ApiError
        ? exc.message
        : "Zustimmung konnte nicht verarbeitet werden.";
    return { ok: false, error };
  }
}
