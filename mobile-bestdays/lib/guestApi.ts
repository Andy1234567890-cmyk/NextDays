// HTTP-Client der GAST-Welt (portal_guests). Bewusst getrennt von lib/api.ts:
// dort sitzt die Tenant-Session (tenant_id + role im JWT), hier der Portal-Gast
// (auth.uid() ohne Tenant). Ein Gerät kann beides gleichzeitig haben — die
// Tokens dürfen sich NIE mischen (CLAUDE.md Mobile: zwei strikt getrennte
// Auth-Welten).
//
// - `guestCall`  → hängt das GAST-Bearer an; bei 401 genau EIN Refresh-Versuch
//                  (single-flight in lib/guestAuth), dann Fehler.
// - `publicCall` → ohne jeden Authorization-Header (booking_engine ist öffentlich;
//                  ein fremdes/abgelaufenes Token hätte dort nichts zu suchen).
import { CONFIG } from "@/lib/config";
import { getGuestToken, refreshGuestSession } from "@/lib/guestAuth";

const BASE = CONFIG.apiUrl;
const PREFIX = "/api/v1";

export class GuestApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

// Gast-Auth-Pfade lösen KEINEN 401→Refresh→Retry aus: ein 401 aus login/register
// ist eine fachliche Antwort, und /guest-auth/refresh würde sich sonst selbst
// aufrufen (Rekursion, Wurzel 2 — das Auth-Limit ist 10/60/IP).
function istGastAuthPfad(path: string): boolean {
  return (
    path.startsWith("/guest-auth/login") ||
    path.startsWith("/guest-auth/register") ||
    path.startsWith("/guest-auth/refresh") ||
    path.startsWith("/guest-auth/password-reset") ||
    // `password-neu` MUSS hier stehen: der Gast hat beim Zurücksetzen kein
    // Token, und `password-reset` matcht diesen Pfad NICHT (startsWith).
    // Ohne den Eintrag haette der Client einen Refresh versucht und die
    // Anfrage waere an der fehlenden Sitzung gescheitert.
    path.startsWith("/guest-auth/password-neu")
  );
}

async function sende<T>(path: string, opts: Options, token: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${PREFIX}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new GuestApiError("Backend nicht erreichbar.", 503);
  }

  if (!res.ok) {
    let detail = `Fehler ${res.status}`;
    try {
      const data = await res.json();
      // FastAPI liefert bei 422 eine Liste — die ist für Gäste unbrauchbar,
      // deshalb nur echte Textmeldungen durchreichen (kein erfundener Text).
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // kein JSON-Body
    }
    throw new GuestApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Roher Gast-Call — wirft GuestApiError. Für ein Result: `guestCall`. */
export async function guestApi<T>(path: string, opts: Options = {}): Promise<T> {
  const token = await getGuestToken();
  try {
    return await sende<T>(path, opts, token);
  } catch (exc) {
    if (exc instanceof GuestApiError && exc.status === 401 && !istGastAuthPfad(path)) {
      const erneuert = await refreshGuestSession();
      if (erneuert) return sende<T>(path, opts, await getGuestToken());
    }
    throw exc;
  }
}

/** Gast-Call, der nie wirft. 401 → klarer Anmelde-Hinweis. */
export async function guestCall<T>(path: string, opts: Options = {}): Promise<Result<T>> {
  try {
    return { ok: true, data: await guestApi<T>(path, opts) };
  } catch (exc) {
    if (exc instanceof GuestApiError) {
      if (exc.status === 401) return { ok: false, error: "Bitte melde dich an." };
      if (exc.status === 429) {
        return { ok: false, error: "Zu viele Versuche — kurz warten (Rate-Limit)." };
      }
      return { ok: false, error: exc.message };
    }
    return { ok: false, error: "Aktion fehlgeschlagen." };
  }
}

/** Öffentlicher Call OHNE Authorization-Header (booking_engine). */
export async function publicCall<T>(path: string, opts: Options = {}): Promise<Result<T>> {
  try {
    return { ok: true, data: await sende<T>(path, opts, null) };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof GuestApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}
