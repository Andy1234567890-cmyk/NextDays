// Server-seitiger Datenzugriff des Backoffice (BFF-Muster wie gastgeber/).
// Der Bearer-Token lebt ausschließlich in einem httpOnly-Cookie und wird NIE
// ins Browser-JS gereicht; Server Components und Server Actions rufen api().
//
// EIGENE Cookie-Namen: Das Backoffice läuft auf einer eigenen Subdomain und
// teilt sich bewusst KEIN Cookie mit gastgeber/ oder plattform/. Ein
// Betriebs-Login darf hier nichts öffnen — und ein hier erbeutetes Cookie
// nichts in den anderen Apps.
import { api as sharedApi, readToken } from "@nextdays/auth/server";

const PROD = process.env.NODE_ENV === "production";

export const ADMIN_COOKIES = {
  // __Host- erzwingt secure + path=/ + kein Domain-Attribut (host-only) —
  // die stärkste Cookie-Bindung, die Browser kennen.
  access: PROD ? "__Host-nd_admin" : "nd_admin",
  refresh: PROD ? "__Host-nd_admin_refresh" : "nd_admin_refresh",
} as const;

interface CallOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
  revalidate?: number;
  /** Echter Browser-User-Agent (nur beim Login, für den Geräteverlauf). */
  clientUserAgent?: string;
  /** Echte Browser-IP (nur beim Login, für den Geräteverlauf). */
  clientIp?: string;
  /** Öffentlicher Endpunkt (kein Login nötig) → ohne Bearer. Genutzt für die
   *  Annahme einer Backoffice-Einladung: dort gibt es noch keine Sitzung. */
  isPublic?: boolean;
}

/** Access-Token des eingeloggten Backoffice-Nutzers (oder null). */
export async function adminToken(): Promise<string | null> {
  return readToken(ADMIN_COOKIES.access);
}

/** Ein Backend-Call server-zu-server mit Bearer aus dem Admin-Cookie.
 *  Wirft ApiError bei !ok. NUR aus Server Components / Server Actions aufrufen.
 *  Pfade sind relativ zu /api/v1 (z. B. "/platform/tenants"). */
export async function api<T>(path: string, opts: CallOpts = {}): Promise<T> {
  return sharedApi<T>(path, {
    method: opts.method,
    body: opts.body,
    cache: opts.cache,
    revalidate: opts.revalidate,
    accessCookie: ADMIN_COOKIES.access,
    isPublic: opts.isPublic,
    clientUserAgent: opts.clientUserAgent,
    clientIp: opts.clientIp,
  });
}

export { ApiError } from "@nextdays/auth/errors";
