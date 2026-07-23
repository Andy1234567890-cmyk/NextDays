// Zentraler Data Access Layer (Gastgeber-Dashboard). Dünner App-Adapter über die
// geteilte Auth-Mechanik @nextdays/auth (ADR-0017): das Package liefert Cookie-
// Mechanik + Backend-fetch, HIER bleibt nur die app-spezifische Sicherheitsgrenze
// (die Cookie-NAMEN der Gastgeber-Welt, getrennt von der Gast-App, ADR-0015).
//
// Modernes App-Router-Muster: KEIN Proxy-Route-Handler. Server Components (Lesen)
// + Server Actions (Schreiben) rufen diese Helfer; Token nie im Browser-JS (BFF).
import { api as sharedApi, readToken } from "@nextdays/auth/server";

export { ApiError } from "@nextdays/auth/errors";

// host-only Cookies des Gastgebers (getrennt vom Gast-Cookie, ADR-0015). __Host-
// erzwingt Secure — lokal (http) daher schlichter Name, damit dev funktioniert.
const PROD = process.env.NODE_ENV === "production";
export const HOST_COOKIES = {
  access: PROD ? "__Host-nd_host" : "nd_host",
  refresh: PROD ? "__Host-nd_host_refresh" : "nd_host_refresh",
} as const;

/** Access-Token des eingeloggten Gastgebers (oder null). */
export async function hostToken(): Promise<string | null> {
  return readToken(HOST_COOKIES.access);
}

interface CallOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
  revalidate?: number;
  /** Öffentliche Endpunkte (kein Login nötig) → ohne Bearer. */
  public?: boolean;
  /** Echter Browser-User-Agent (nur beim Login, für den Geräteverlauf). */
  clientUserAgent?: string;
  /** Echte Browser-IP (nur beim Login, für den Geräteverlauf). */
  clientIp?: string;
}

/** Ein Backend-Call server-zu-server mit Bearer aus dem Host-Cookie.
 *  Wirft ApiError bei !ok. NUR aus Server Components / Server Actions aufrufen. */
export async function api<T>(path: string, opts: CallOpts = {}): Promise<T> {
  return sharedApi<T>(path, {
    method: opts.method,
    body: opts.body,
    cache: opts.cache,
    revalidate: opts.revalidate,
    isPublic: opts.public,
    accessCookie: HOST_COOKIES.access,
    clientUserAgent: opts.clientUserAgent,
    clientIp: opts.clientIp,
  });
}
