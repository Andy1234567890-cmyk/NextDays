// Session des PORTAL-GASTES (guest_auth-Slice). Eigene Keychain-Einträge, damit
// Gast- und Tenant-Session nebeneinander bestehen können, ohne sich zu
// überschreiben (zwei strikt getrennte Auth-Welten, CLAUDE.md Mobile).
// Tokens liegen NUR im Schlüsselbund (nie AsyncStorage) und werden nie geloggt.
import * as Keychain from "react-native-keychain";

import { guestApi, GuestApiError, type Result } from "@/lib/guestApi";

const SERVICE = "mybestdays.guest";
const ACCESS_ACCOUNT = "ndg_access";
const REFRESH_ACCOUNT = "ndg_refresh";

// In-Memory-Cache (undefined = noch nicht aus dem Schlüsselbund gelesen).
let cachedAccess: string | null | undefined;
let cachedRefresh: string | null | undefined;
let expiresAt = 0;

// Contract: guest_auth/schemas.py → GuestSessionResponse.
type GuestSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  // Nur bei der Code-Anmeldung: der Gast ist angemeldet, aber der NAME fehlt
  // noch (Erstanmeldung). Ohne Namen ist eine Reservierung für den Gastgeber
  // unbrauchbar, deshalb fragt die Oberfläche ihn nach.
  profil_fehlt?: boolean;
};

// Contract: guest_auth/schemas.py → GuestProfileResponse.
export type GuestProfile = {
  guest_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  preferred_locale: string | null;
  preferred_currency: string | null;
  marketing_opt_in: boolean;
};

export type GuestRegisterInput = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  preferred_locale?: string;
  preferred_currency?: string;
};

async function leseKonto(account: string): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: `${SERVICE}.${account}` });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

async function schreibeKonto(account: string, value: string | null): Promise<void> {
  try {
    if (value) {
      await Keychain.setGenericPassword(account, value, { service: `${SERVICE}.${account}` });
    } else {
      await Keychain.resetGenericPassword({ service: `${SERVICE}.${account}` });
    }
  } catch {
    // Schlüsselbund nicht verfügbar — in-memory reicht für die laufende Session.
  }
}

export async function getGuestToken(): Promise<string | null> {
  if (cachedAccess === undefined) cachedAccess = await leseKonto(ACCESS_ACCOUNT);
  return cachedAccess;
}

// Abonnenten des Gast-Tokens (Realtime-Client: setAuth nach Refresh/Logout).
type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

export function onGuestTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

async function getGuestRefreshToken(): Promise<string | null> {
  if (cachedRefresh === undefined) cachedRefresh = await leseKonto(REFRESH_ACCOUNT);
  return cachedRefresh;
}

async function speichereSession(session: GuestSession | null): Promise<void> {
  if (session) {
    cachedAccess = session.access_token;
    cachedRefresh = session.refresh_token;
    expiresAt = Math.floor(Date.now() / 1000) + session.expires_in;
    await schreibeKonto(ACCESS_ACCOUNT, session.access_token);
    await schreibeKonto(REFRESH_ACCOUNT, session.refresh_token);
  } else {
    cachedAccess = null;
    cachedRefresh = null;
    expiresAt = 0;
    await schreibeKonto(ACCESS_ACCOUNT, null);
    await schreibeKonto(REFRESH_ACCOUNT, null);
  }
  for (const listener of tokenListeners) listener(cachedAccess);
}

function fehlertext(exc: unknown, fallback: string): string {
  if (exc instanceof GuestApiError) {
    if (exc.status === 429) return "Zu viele Versuche — kurz warten (Rate-Limit).";
    if (exc.status === 422) return fallback;
    return exc.message;
  }
  return fallback;
}

/** E-Mail + Passwort → Gast-Session (speichert beide Tokens). */
export async function guestLogin(email: string, password: string): Promise<Result<true>> {
  try {
    const session = await guestApi<GuestSession>("/guest-auth/login", {
      method: "POST",
      body: { email, password },
    });
    await speichereSession(session);
    return { ok: true, data: true };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Anmeldung fehlgeschlagen.") };
  }
}

/** Neues Gast-Konto (portal_guests) — liefert direkt eine Session. */
export async function guestRegister(input: GuestRegisterInput): Promise<Result<true>> {
  try {
    const session = await guestApi<GuestSession>("/guest-auth/register", {
      method: "POST",
      body: input,
    });
    await speichereSession(session);
    return { ok: true, data: true };
  } catch (exc) {
    if (exc instanceof GuestApiError && exc.status === 409) {
      return { ok: false, error: "Diese E-Mail ist bereits registriert." };
    }
    return {
      ok: false,
      error: fehlertext(exc, "Registrierung fehlgeschlagen (Passwort mind. 8 Zeichen?)."),
    };
  }
}

/** Neues Passwort mit dem CODE aus der Reset-Mail setzen — liefert eine Session.
 *
 *  Der Code und nicht der Link: der Link in der Mail zeigte auf
 *  `{API_EXTERNAL_URL}/verify?token=…`, und weil jene GoTrue-Variable die
 *  Kong-Basis OHNE `/auth/v1` ist, endete er in Kongs „no Route matched"
 *  (gemessen 03.09.2026). In einer App ist ein Link ohnehin der schlechtere
 *  Weg — der Code lässt sich abtippen, ohne die App zu verlassen. */
export async function guestPasswortNeu(
  email: string,
  code: string,
  password: string,
): Promise<Result<true>> {
  try {
    const session = await guestApi<GuestSession>("/guest-auth/password-neu", {
      method: "POST",
      body: { email, code, password },
    });
    await speichereSession(session);
    return { ok: true, data: true };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Passwort setzen fehlgeschlagen.") };
  }
}

/** Passwort-Reset anstoßen. Antwortet serverseitig immer 200 (kein Existenz-Leak). */
export async function guestPasswordReset(email: string): Promise<Result<string>> {
  try {
    const res = await guestApi<{ message: string }>("/guest-auth/password-reset", {
      method: "POST",
      body: { email },
    });
    return { ok: true, data: res.message };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Anfrage fehlgeschlagen.") };
  }
}

// --- Anmeldung per Einmal-Code (Airbnb-Muster) -------------------------------
//
// Die Reihenfolge im Checkout ist bei Airbnb live abgelesen (19.08.2026):
// 1. einloggen oder registrieren → 2. Zahlungsart → 3. prüfen. Schritt 2 ist
// ohne Schritt 1 nicht erreichbar. Ein Passwort gibt es hier NICHT: der Gast
// tippt seine Adresse, bekommt einen Code und ist drin. Erzeugt und geprüft
// wird der Code von GoTrue (`guest_auth/codeanmeldung.py`).

/** Schritt 1: Code an die Adresse schicken. Antwortet immer neutral — ob die
 *  Adresse ein Konto hat, sagt der Server bewusst nicht. */
export async function guestCodeAnfordern(
  email: string,
  locale?: string,
): Promise<Result<string>> {
  try {
    const res = await guestApi<{ message: string }>("/guest-auth/code", {
      method: "POST",
      body: { email: email.trim(), locale: locale ?? null },
    });
    return { ok: true, data: res.message };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Code konnte nicht verschickt werden.") };
  }
}

/** Schritt 2: Code prüfen → Session. `true` = Name fehlt noch (Erstanmeldung). */
export async function guestCodePruefen(
  email: string,
  code: string,
): Promise<Result<{ profilFehlt: boolean }>> {
  try {
    const session = await guestApi<GuestSession>("/guest-auth/code/verify", {
      method: "POST",
      body: { email: email.trim(), code: code.trim() },
    });
    await speichereSession(session);
    return { ok: true, data: { profilFehlt: session.profil_fehlt === true } };
  } catch (exc) {
    return {
      ok: false,
      error: fehlertext(exc, "Code ist ungültig oder abgelaufen."),
    };
  }
}

/** Schritt 3 (nur bei Erstanmeldung): Namen nachtragen. Braucht die Session
 *  aus Schritt 2 — der Server schreibt ausschließlich die eigene Zeile. */
export async function guestProfilAnlegen(input: {
  name: string;
  phone?: string;
  preferred_locale?: string;
  preferred_currency?: string;
}): Promise<Result<GuestProfile>> {
  try {
    const profil = await guestApi<GuestProfile>("/guest-auth/code/profil", {
      method: "POST",
      body: input,
    });
    return { ok: true, data: profil };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Name konnte nicht gespeichert werden.") };
  }
}

export async function guestLogout(): Promise<void> {
  await speichereSession(null);
}

// --- Silent-Refresh (single-flight) -----------------------------------------

let inFlight: Promise<boolean> | null = null;

/**
 * Tauscht das Gast-Refresh-Token gegen eine frische Session. true = erneuert;
 * false = kein/ungültiges Token. Parallele 401-Retries teilen sich EIN Promise
 * (Wurzel 2 — sonst n Refresh-Requests gegen ein 10/60/IP-Limit).
 */
export function refreshGuestSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const refresh = await getGuestRefreshToken();
    if (!refresh) {
      await speichereSession(null);
      return false;
    }
    try {
      const session = await guestApi<GuestSession>("/guest-auth/refresh", {
        method: "POST",
        body: { refresh_token: refresh },
      });
      await speichereSession(session);
      return true;
    } catch (exc) {
      // 401 = Token ungültig/widerrufen → fail-closed ausloggen. Netzfehler
      // NICHT als Logout werten (transienter Ausfall ≠ Sessionende).
      if (exc instanceof GuestApiError && exc.status === 401) {
        await speichereSession(null);
      }
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Läuft das Gast-Access-Token (bald) ab? 0 = unbekannt → kein proaktiver Refresh. */
export function isGuestTokenExpired(skewSeconds = 30): boolean {
  if (!expiresAt) return false;
  return Math.floor(Date.now() / 1000) >= expiresAt - skewSeconds;
}

// --- Profil ------------------------------------------------------------------

export async function getGuestProfile(): Promise<GuestProfile> {
  return guestApi<GuestProfile>("/guest-auth/me");
}

export async function updateGuestProfile(input: {
  name?: string;
  phone?: string;
  preferred_locale?: string;
  preferred_currency?: string;
  marketing_opt_in?: boolean;
}): Promise<Result<GuestProfile>> {
  try {
    return { ok: true, data: await guestApi<GuestProfile>("/guest-auth/me", { method: "PATCH", body: input }) };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Speichern fehlgeschlagen.") };
  }
}

// --- Konto löschen (Apple 5.1.1(v), Google Play) -----------------------------
// Apple verlangt den Löschweg IN der App, sobald man dort ein Konto anlegen kann;
// Google verlangt zusätzlich einen Web-Weg für Leute, die die App schon
// deinstalliert haben.

export type GuestLoeschErgebnis = {
  geloescht: boolean;
  detail: string;
  /**
   * Was NICHT verschwindet: bereits getätigte Buchungen bleiben beim Gastgeber.
   * Das muss vor bzw. mit der Bestätigung dastehen — sonst glaubt der Gast, mit
   * dem Konto sei auch die Reise weg, und steht vor verschlossener Tür.
   */
  hinweis: string;
};

/**
 * Eigenes Gast-Konto löschen. Das Passwort ist Pflicht: ein gekapertes Token
 * allein darf kein Konto vernichten (Wurzel 7).
 */
export async function deleteGuestAccount(
  password: string,
): Promise<Result<GuestLoeschErgebnis>> {
  try {
    return {
      ok: true,
      data: await guestApi<GuestLoeschErgebnis>("/guest-auth/me", {
        method: "DELETE",
        body: { password },
      }),
    };
  } catch (exc) {
    return { ok: false, error: fehlertext(exc, "Löschen fehlgeschlagen.") };
  }
}
