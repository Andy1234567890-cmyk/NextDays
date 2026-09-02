// Server-seitiger Datenzugriff des Partner-Dashboards (BFF-Muster wie
// gastgeber/ und admin/). Der Bearer-Token lebt ausschließlich in einem
// httpOnly-Cookie und wird NIE ins Browser-JS gereicht.
//
// EIGENE Cookie-Namen: die Partner-Welt teilt sich KEIN Cookie mit dem
// Dashboard der Betriebe, dem Backoffice oder den Gästen (ADR-0015/0017). Ein
// Betriebs-Login darf hier nichts öffnen — und umgekehrt.
import { api as sharedApi, readToken } from "@nextdays/auth/server";

export { ApiError } from "@nextdays/auth/errors";

const PROD = process.env.NODE_ENV === "production";

export const PARTNER_COOKIES = {
  access: PROD ? "__Host-nd_partner" : "nd_partner",
  refresh: PROD ? "__Host-nd_partner_refresh" : "nd_partner_refresh",
} as const;

interface CallOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
  isPublic?: boolean;
  token?: string;
  clientUserAgent?: string;
  clientIp?: string;
}

export async function partnerToken(): Promise<string | null> {
  return readToken(PARTNER_COOKIES.access);
}

/** Ein Backend-Call server-zu-server mit Bearer aus dem Partner-Cookie.
 *  Pfade relativ zu /api/v1 (z. B. "/affiliates/me"). */
export async function api<T>(path: string, opts: CallOpts = {}): Promise<T> {
  return sharedApi<T>(path, {
    method: opts.method,
    body: opts.body,
    cache: opts.cache ?? "no-store",
    isPublic: opts.isPublic,
    token: opts.token,
    accessCookie: PARTNER_COOKIES.access,
    clientUserAgent: opts.clientUserAgent,
    clientIp: opts.clientIp,
    app: "partner",
  });
}
