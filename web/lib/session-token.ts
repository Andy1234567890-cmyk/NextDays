"use server";

// Liefert das Access-Token des eingeloggten Nutzers für FastAPI-Aufrufe.
// Quelle: FastAPI-Cookie nd_access ODER Supabase-OAuth-Session (Google).
// getUser() zuerst validiert/erneuert die Session serverseitig (@supabase/ssr).
// Cookie-Read + JWT-email-Decoder aus @nextdays/auth (ADR-0017); die
// Supabase-OAuth-Welt bleibt web-spezifisch (nur web hat Google-Login).
import { cookies } from "next/headers";

import { emailFromToken, persistSession, readToken } from "@nextdays/auth/server";

import { api, type SessionResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const ACCESS = "nd_access";
const REFRESH = "nd_refresh";
const COOKIES = { access: ACCESS, refresh: REFRESH } as const;

/**
 * Laufende Token-Tauschvorgänge, je Refresh-Token genau einer.
 *
 * Serverseitig, also pro Next-Prozess — und genau dort entsteht das Problem:
 * mehrere Abfragen DERSELBEN Seite laufen im selben Prozess gleichzeitig los.
 * Der Schlüssel ist das Refresh-Token selbst, damit sich nie zwei verschiedene
 * Nutzer denselben Eintrag teilen. Einträge werden nach dem Tausch sofort
 * entfernt, die Map bleibt also klein.
 */
const imTausch = new Map<string, Promise<string | null>>();

/**
 * Access-Token für FastAPI-Aufrufe.
 *
 * Drei Quellen, in dieser Reihenfolge:
 *   1. `nd_access` (gültig) — der Normalfall
 *   2. `nd_refresh` gegen ein NEUES Access-Token einlösen
 *   3. Supabase-OAuth-Session (Google-Login, nur `web`)
 *
 * Warum Schritt 2 hier stehen MUSS: `nd_access` trägt `maxAge = expires_in`, ist
 * also nach Ablauf aus dem Jar verschwunden. Der 30-Tage-`nd_refresh` wurde beim
 * Login gesetzt — und danach nie eingelöst. Folge: nach Ablauf des kurzen
 * Access-Tokens antwortete JEDE Aktion 401 „Ungültiges oder abgelaufenes Token",
 * bis sich der Nutzer von Hand neu anmeldete. Der Endpunkt `POST /auth/refresh`
 * existierte die ganze Zeit; er war nur nicht angeschlossen.
 */
export async function currentToken(): Promise<string | null> {
  const fromCookie = await readToken(ACCESS);
  if (fromCookie) return fromCookie;

  const refreshed = await tokenAusRefresh();
  if (refreshed) return refreshed;

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

/**
 * Refresh-Token gegen eine neue Session tauschen. `null`, wenn keiner da ist
 * oder das Backend ihn ablehnt (dann ist der Nutzer wirklich abgemeldet —
 * fail-closed, kein Weiterreichen eines toten Tokens).
 *
 * Das Neu-Setzen der Cookies kann in einem Server-Component-Render scheitern
 * (dort ist das Cookie-Jar nur lesbar). Das ist verkraftbar und darf den Aufruf
 * nicht kippen: das frische Token wird zurückgegeben und der Request läuft
 * durch; gespeichert wird es beim nächsten Aufruf aus einer Server-Action.
 */
async function tokenAusRefresh(): Promise<string | null> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH)?.value;
  if (!refresh) return null;

  // Läuft schon ein Tausch mit GENAU DIESEM Token, hängen wir uns an ihn statt
  // einen zweiten zu starten. Refresh-Tokens sind bei Supabase EINMAL-Tokens:
  // von zwölf parallelen Einlösungen gewinnt eine, die übrigen elf bekommen
  // „Invalid Refresh Token: Already Used" — und damit ist die Sitzung tot, der
  // Nutzer fliegt raus. Genau so passiert am 06.08.2026 (18:15), als nach einem
  // minutenlangen Import sechs Seitenabfragen gleichzeitig 401 bekamen und jede
  // ihren eigenen Refresh startete.
  const laufend = imTausch.get(refresh);
  if (laufend) return laufend;

  const versuch = (async () => {
    try {
      const session = await api<SessionResponse>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refresh },
      });
      if (!session?.access_token) return null;
      try {
        await persistSession(session, COOKIES);
      } catch {
        // Nur-Lese-Jar (Server-Component-Render) — Token trotzdem verwenden.
      }
      return session.access_token;
    } catch {
      // Refresh-Token abgelaufen/entzogen → wirklich abgemeldet.
      return null;
    } finally {
      // Immer aufräumen, auch im Fehlerfall: sonst bliebe ein totes Ergebnis
      // für dieses Token für immer stehen und ein späterer, berechtigter
      // Versuch bekäme das alte `null` zurück.
      imTausch.delete(refresh);
    }
  })();

  imTausch.set(refresh, versuch);
  return versuch;
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
