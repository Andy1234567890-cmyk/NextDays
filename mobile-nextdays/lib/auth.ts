// Auth-Token-Verwaltung der Mobile-App. Access- UND Refresh-Token sicher im
// Schlüsselbund (react-native-keychain, getrennte Accounts), plus expires_at.
// Login/Refresh laufen über den auth-Slice des Backends (/auth/login,
// /auth/refresh). Tokens werden NIE geloggt (CLAUDE.md Mobile).
import * as Keychain from "react-native-keychain";

import { api, ApiError, type Result } from "@/lib/api";
import { faktorenDerSitzung, faktorLoesen, smsCodeAnfordern } from "@/lib/mfa-login";

const SERVICE = "mynextdays.auth";
const ACCESS_ACCOUNT = "nd_access";
const REFRESH_ACCOUNT = "nd_refresh";

// In-Memory-Cache (undefined = noch nicht aus Keychain geladen).
let cachedAccess: string | null | undefined;
let cachedRefresh: string | null | undefined;
// Unix-Sekunden, zu denen das Access-Token abläuft (0 = unbekannt).
let expiresAt = 0;

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

// Contract: auth/schemas.py → LoginResponse. Genau EINE der beiden Welten ist
// gesetzt: ohne 2FA `session`, mit 2FA `mfa_required=true` + `mfa_token`.
// /auth/register und /auth/refresh liefern dagegen weiterhin flach eine
// SessionResponse — nur /auth/login ist gehüllt.
type LoginResponse = {
  mfa_required: boolean;
  session: SessionResponse | null;
  mfa_token?: string | null;
  mfa_methods?: string[];
  mfa_phone_masked?: string | null;
};

async function readAccount(account: string): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: `${SERVICE}.${account}` });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

async function writeAccount(account: string, value: string | null): Promise<void> {
  try {
    if (value) {
      await Keychain.setGenericPassword(account, value, { service: `${SERVICE}.${account}` });
    } else {
      await Keychain.resetGenericPassword({ service: `${SERVICE}.${account}` });
    }
  } catch {
    // Keychain nicht verfügbar — in-memory reicht für die Session.
  }
}

export async function getToken(): Promise<string | null> {
  if (cachedAccess === undefined) cachedAccess = await readAccount(ACCESS_ACCOUNT);
  return cachedAccess;
}

// Abonnenten des Access-Tokens (z. B. der Realtime-Client, der bei jedem
// Refresh/Logout sein setAuth erneuern muss — kein Polling). Wird bei jeder
// Token-Änderung mit dem neuen Token (oder null bei Logout) aufgerufen.
type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

export function onTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

/**
 * Der Refresh-Token der laufenden Sitzung.
 *
 * Exportiert für die 2FA-Einrichtung: sie läuft GoTrue-NATIV (0341), also über
 * `supabase-js`, und dieser Client braucht eine echte Session
 * (`setSession({ access_token, refresh_token })`). Was GoTrue selbst kann, wird
 * nicht durch die FastAPI gespiegelt — sonst gäbe es zwei Wahrheiten.
 */
export async function getRefreshTokenFuerMfa(): Promise<string | null> {
  return getRefreshToken();
}

async function getRefreshToken(): Promise<string | null> {
  if (cachedRefresh === undefined) cachedRefresh = await readAccount(REFRESH_ACCOUNT);
  return cachedRefresh;
}

// Beide Tokens atomar setzen (bei Login/Refresh) oder löschen (Logout).
// Benachrichtigt danach die Token-Abonnenten (Realtime setAuth erneuern).
async function storeSession(session: SessionResponse | null): Promise<void> {
  if (session) {
    cachedAccess = session.access_token;
    cachedRefresh = session.refresh_token;
    expiresAt = Math.floor(Date.now() / 1000) + session.expires_in;
    await writeAccount(ACCESS_ACCOUNT, session.access_token);
    await writeAccount(REFRESH_ACCOUNT, session.refresh_token);
  } else {
    cachedAccess = null;
    cachedRefresh = null;
    expiresAt = 0;
    await writeAccount(ACCESS_ACCOUNT, null);
    await writeAccount(REFRESH_ACCOUNT, null);
  }
  for (const listener of tokenListeners) listener(cachedAccess);
}

/** Ergebnis des Passwort-Schritts: fertig, gescheitert — oder 2FA offen. */
export type LoginErgebnis =
  | { ok: true; data: true }
  | { ok: false; error: string }
  | { ok: false; mfaRequired: true; methods: string[]; phoneMasked: string | null };

// Die aal1-Sitzung zwischen Schritt 1 und 2. NUR im Speicher, bewusst nicht im
// Keychain: sie ist 5 Minuten wert, öffnet keine API-Route, und ein Neustart
// der App soll den halben Login nicht überleben — dann beginnt er von vorn.
let aal1: { access_token: string; refresh_token: string } | null = null;

/** Die offene 2FA verwerfen (Abbruch, Logout, gelöster Faktor). */
export function mfaVerwerfen(): void {
  aal1 = null;
}

// E-Mail/Passwort-Login gegen das Backend; speichert beide Tokens bei Erfolg.
//
// Contract: auth/schemas.py → LoginResponse. Die Antwort ist NICHT die Session
// selbst, sondern eine Hülle: bei aktivem 2FA kommt `mfa_required=true` und
// `session=null`, sonst `session` gefüllt. Die Session flach zu erwarten
// lieferte `access_token: undefined` — der Login sah erfolgreich aus und
// /auth/me kippte danach in „Konto konnte nicht geladen werden".
export async function login(email: string, password: string): Promise<LoginErgebnis> {
  try {
    const antwort = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (antwort.mfa_required) {
      // Zweiter Faktor nötig. Die aal1-Session wird NICHT gespeichert: sie
      // öffnet keine API-Route, und `storeSession` würde die Realtime-
      // Abonnenten auf ein Token umstellen, mit dem keine Policy greift (tote
      // Abos). Sie bleibt nur im Speicher, bis der Faktor gelöst ist.
      if (!antwort.session) {
        // Nativer Faktor ohne aal1-Session waere ein Vertragsbruch des
        // Servers — ohne sie ist die GoTrue-Challenge nicht loesbar. Nicht
        // raten, klar abbrechen (Wurzel 5).
        return { ok: false, error: "Zweiter Faktor nicht lösbar: keine Sitzung erhalten." };
      }
      aal1 = {
        access_token: antwort.session.access_token,
        refresh_token: antwort.session.refresh_token,
      };
      return {
        ok: false,
        mfaRequired: true,
        methods: antwort.mfa_methods ?? [],
        phoneMasked: antwort.mfa_phone_masked ?? null,
      };
    }
    if (!antwort.session) {
      return { ok: false, error: "Anmeldung ohne Sitzung — bitte erneut versuchen." };
    }
    await storeSession(antwort.session);
    return { ok: true, data: true };
  } catch (exc) {
    // Echte Ursache anzeigen statt Einheitstext: „Backend nicht erreichbar."
    // (503), Backend-Detail bei 401/422, Rate-Limit bei 429 — sonst generisch.
    // Kein Verschlucken der Diagnose (Wurzel 5 sinngemäß im UI).
    if (exc instanceof ApiError) {
      if (exc.status === 429) {
        return { ok: false, error: "Zu viele Versuche — kurz warten (Rate-Limit)." };
      }
      return { ok: false, error: exc.message };
    }
    return { ok: false, error: "Login fehlgeschlagen." };
  }
}

/** Welche Faktoren das Konto hat (factor_id je Typ) — aus der aal1-Sitzung. */
export async function mfaFaktoren(): Promise<Result<Record<string, string>>> {
  if (!aal1) return { ok: false, error: "Kein offener Anmeldevorgang." };
  const res = await faktorenDerSitzung(aal1);
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
}

/**
 * Schritt 2: Faktor lösen und die aal2-Sitzung übernehmen.
 *
 * Erst HIER wird gespeichert — vorher gibt es keine Session, mit der die API
 * spricht. Die aal1-Sitzung wird danach verworfen: sie ist verbraucht, und ein
 * zweiter Versuch mit demselben Code wäre ohnehin ungültig.
 */
export async function mfaLoesen(factorId: string, code: string): Promise<Result<true>> {
  if (!aal1) return { ok: false, error: "Kein offener Anmeldevorgang." };
  const res = await faktorLoesen(aal1, factorId, code.trim().replace(/\s/g, ""));
  if (!res.ok) return { ok: false, error: res.error };
  await storeSession({
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    token_type: "bearer",
    expires_in: res.data.expires_in,
  });
  aal1 = null;
  return { ok: true, data: true };
}

/** SMS-Code anfordern (nur bei `phone`-Faktor). */
export async function mfaSmsAnfordern(factorId: string): Promise<Result<true>> {
  if (!aal1) return { ok: false, error: "Kein offener Anmeldevorgang." };
  const res = await smsCodeAnfordern(aal1, factorId);
  return res.ok ? { ok: true, data: true } : { ok: false, error: res.error };
}

// Tenant-Registrierung (Agentur/self_managed) gegen /auth/register — legt Konto
// + Tenant an und liefert direkt eine Session. Contract: RegisterRequest. Kein
// Default für country/currency (Wurzel 4) — die Felder MÜSSEN gefüllt sein.
export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
  country: string; // ISO-3166-1 alpha-2
  currency: string; // ISO-4217
  business_type: "agency" | "self_managed";
};

export async function register(input: RegisterInput): Promise<Result<true>> {
  try {
    const session = await api<SessionResponse>("/auth/register", {
      method: "POST",
      body: input,
    });
    await storeSession(session);
    return { ok: true, data: true };
  } catch (exc) {
    // Serverfehler (z. B. E-Mail vergeben) klar durchreichen, kein Fantasietext.
    const msg =
      exc instanceof ApiError && exc.status === 409
        ? "Diese E-Mail ist bereits registriert."
        : "Registrierung fehlgeschlagen.";
    return { ok: false, error: msg };
  }
}

export async function logout(): Promise<void> {
  await storeSession(null);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getToken()) !== null;
}

// --- Silent-Refresh (single-flight) ---

// Ein laufender Refresh wird geteilt: parallele 401-Retries lösen NICHT je einen
// eigenen /auth/refresh aus (Wurzel 2 — Auth-Limit ist 10/60/IP).
let inFlight: Promise<boolean> | null = null;

/**
 * Tauscht das gespeicherte Refresh-Token gegen eine frische Session.
 * Ergebnis: true = erneuert; false = kein/ungültiges Token → ausgeloggt (Tokens
 * gelöscht). Mehrere gleichzeitige Aufrufe teilen sich EIN Promise.
 */
export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) {
      await storeSession(null);
      return false;
    }
    try {
      const session = await api<SessionResponse>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refresh },
      });
      await storeSession(session);
      return true;
    } catch (exc) {
      // 401 (Token ungültig/abgelaufen/widerrufen) → fail-closed: ausloggen.
      // Andere Fehler (Netz) ebenfalls als „nicht erneuert" behandeln, aber
      // ohne die Tokens zu löschen (transienter Ausfall ≠ Logout).
      if (exc instanceof ApiError && exc.status === 401) {
        await storeSession(null);
      }
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// Prüft, ob das Access-Token (bald) abgelaufen ist — für proaktiven Refresh.
export function isExpired(skewSeconds = 30): boolean {
  if (!expiresAt) return false; // unbekannt → nicht proaktiv refreshen
  return Math.floor(Date.now() / 1000) >= expiresAt - skewSeconds;
}
