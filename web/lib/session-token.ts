"use server";

// Liefert das Access-Token des eingeloggten Nutzers für FastAPI-Aufrufe.
// Quelle: FastAPI-Cookie nd_access ODER Supabase-OAuth-Session (Google).
// getUser() zuerst validiert/erneuert die Session serverseitig (@supabase/ssr).
// Cookie-Read + JWT-email-Decoder aus @nextdays/auth (ADR-0017); die
// Supabase-OAuth-Welt bleibt web-spezifisch (nur web hat Google-Login).
import { cookies } from "next/headers";

import { emailFromToken, persistSession, readToken } from "@nextdays/auth/server";

import { ApiError, api, type SessionResponse } from "@/lib/api";
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
const imTausch = new Map<string, Promise<TauschErgebnis>>();

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
  return tokenHolen(false);
}

/**
 * Wie `currentToken()`, wirft aber bei TECHNISCHEN Fehlern (429/503/Timeout)
 * eine `ApiError` weiter, statt `null` zu liefern.
 *
 * Nur für Aufrufer, die über An-/Abmeldung ENTSCHEIDEN (`getSession`): dort
 * muss „gerade nicht möglich" von „wirklich abgemeldet" unterscheidbar sein,
 * sonst wird aus einem kurzen Backend-Aussetzer ein Rauswurf auf /login
 * (Wurzel 5). Die übrigen ~45 Aufrufer wollen nur ein Token fürs UI-Gating und
 * behandeln `null` als „nicht angemeldet" — für sie bleibt `currentToken()`
 * unverändert, ein Wurf würde dort ungefangen durchschlagen.
 */
export async function currentTokenStreng(): Promise<string | null> {
  return tokenHolen(true);
}

/**
 * Access- UND Refresh-Token der laufenden Sitzung.
 *
 * NUR für die 2FA-Einrichtung (lib/mfa.ts → lib/mfa-client.ts): GoTrue macht
 * Enrollment/Verify der echten Faktoren im Browser und braucht dort eine echte
 * Session (`supabase.auth.setSession`). Unsere Sitzung liegt in
 * httpOnly-Cookies, an die JavaScript bewusst nicht herankommt — ohne diesen
 * Weg könnte ein Cookie-Login-Nutzer gar keinen Faktor einrichten.
 *
 * Bewusst KEIN allgemeiner Helfer: wer nur ein Bearer-Token für einen
 * FastAPI-Aufruf braucht, nimmt `currentToken()`. Das Refresh-Token hier
 * herauszureichen ist die Ausnahme, nicht die Regel.
 *
 * `null`, wenn keine der beiden Token-Quellen etwas liefert. Bei reinen
 * OAuth-Konten (Google) kommt die Session aus dem Supabase-Client, der im
 * Browser ohnehin schon eine eigene Session hat.
 */
export async function sessionTokens(): Promise<{
  access_token: string;
  refresh_token: string;
} | null> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH)?.value;
  const access = await tokenHolen(false);
  if (access && refresh) return { access_token: access, refresh_token: refresh };

  // OAuth-Welt (Google): dort führt der Supabase-Client die Session selbst.
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token && session?.refresh_token) {
      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };
    }
  } catch {
    // Keine Supabase-Session — unten fail-closed mit null.
  }
  return null;
}

async function tokenHolen(streng: boolean): Promise<string | null> {
  const fromCookie = await readToken(ACCESS);
  if (fromCookie) return fromCookie;

  const refreshed = await tokenAusRefresh(streng);
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
async function tokenAusRefresh(streng: boolean): Promise<string | null> {
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
  // Das gecachte Promise liefert IMMER ein Ergebnis-Objekt und wirft nie:
  // an denselben Tausch hängen sich strenge und nicht-strenge Aufrufer
  // gleichzeitig. Würde es werfen, träfe der Wurf auch die ~45 Aufrufer, die
  // nur `null` erwarten. Ob ein technischer Fehler weitergereicht wird,
  // entscheidet deshalb jeder Aufrufer für sich (unten), nicht der Tausch.
  const laufend = imTausch.get(refresh) ?? starteTausch(refresh);

  const ergebnis = await laufend;
  if (ergebnis.token) return ergebnis.token;
  if (streng && ergebnis.fehler) throw ergebnis.fehler;
  return null;
}

/** Ergebnis eines Token-Tauschs. `fehler` gesetzt = technisch fehlgeschlagen
 *  (429/503/Timeout), die Sitzung gilt weiter. Beides leer = echte Ablehnung
 *  (401/403), der Nutzer ist wirklich abgemeldet. */
interface TauschErgebnis {
  token: string | null;
  fehler: unknown;
}

function starteTausch(refresh: string): Promise<TauschErgebnis> {
  const versuch = (async (): Promise<TauschErgebnis> => {
    try {
      const session = await api<SessionResponse>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refresh },
      });
      if (!session?.access_token) return { token: null, fehler: null };
      try {
        await persistSession(session, COOKIES);
      } catch {
        // Nur-Lese-Jar (Server-Component-Render) — Token trotzdem verwenden.
        // Seit es die middleware.ts gibt, ist das der Ausnahmefall: sie
        // erneuert vorab dort, wo das Jar schreibbar ist.
      }
      return { token: session.access_token, fehler: null };
    } catch (e) {
      // Wurzel 5: NUR eine echte Ablehnung (401/403) beendet die Sitzung. Ein
      // blankes `catch` machte hier aus JEDEM Fehler ein „abgemeldet" — 429 aus
      // dem Rate-Limit, 503 bei nicht erreichbarem Backend, ein Timeout. Der
      // Aufrufer sah nur `null` und konnte den Unterschied nicht mehr erkennen;
      // der Layout-Guard warf den eingeloggten Nutzer auf /login, obwohl sein
      // Token einwandfrei war.
      const abgelehnt =
        e instanceof ApiError && (e.status === 401 || e.status === 403);
      return { token: null, fehler: abgelehnt ? null : e };
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
