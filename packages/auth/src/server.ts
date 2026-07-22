"use server";

// Geteilte SERVER-Auth-Mechanik (BFF, ADR-0017). Läuft NUR im App-Router-
// Server-Kontext (cookies() aus next/headers). NIE ins Client-Bundle (eigener
// /server-Entry-Point, kein gemischter Export).
//
// SICHERHEITSGRENZE (ADR-0017 / Wurzel 4): dieser Code kennt weder „Tenant" noch
// „Gast". Cookie-Namen kommen IMMER als Pflicht-Argument aus der App — es gibt
// KEINEN Default-Cookie-Namen (ein Default könnte versehentlich die falsche
// Session setzen → vertauschte Sessions). Fehlt der Name, wird hart gefehlschlagen.
import { cookies } from "next/headers";

import { ApiError } from "./errors";
import type { CookieNames, SessionResponse } from "./types";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PROD = process.env.NODE_ENV === "production";

// requireName ist keine exportierte Funktion — in "use server" erlaubt (nur
// EXPORTE müssen async sein). Interne Helfer dürfen synchron sein.
function requireName(name: string, which: string): string {
  // Wurzel 4: kein Fallback/Default — fehlt der Cookie-Name, ist das ein
  // Programmierfehler, kein plausibler Ersatzwert.
  if (!name) {
    throw new Error(
      `@nextdays/auth: Cookie-Name (${which}) fehlt — pro App explizit setzen.`,
    );
  }
  return name;
}

/** Access-Token des eingeloggten Nutzers aus dem Session-Cookie (oder null). */
export async function readToken(accessCookie: string): Promise<string | null> {
  requireName(accessCookie, "access");
  const jar = await cookies();
  return jar.get(accessCookie)?.value ?? null;
}

interface CallOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
  revalidate?: number;
  /** Öffentliche Endpunkte (kein Login nötig) → ohne Bearer. */
  isPublic?: boolean;
  /** Access-Cookie-Name — nötig, sobald ein Bearer angehängt werden soll. */
  accessCookie?: string;
  /** Expliziter Bearer (z. B. frisch aus einem Login), überschreibt das Cookie. */
  token?: string;
}

/** Ein Backend-Call server-zu-server. Hängt den Bearer aus dem Session-Cookie
 *  (oder opts.token) an und mappt Fehler auf ApiError. NUR aus Server
 *  Components / Server Actions aufrufen (BFF — Token nie im Browser-JS). */
export async function api<T>(path: string, opts: CallOpts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!opts.isPublic) {
    const token =
      opts.token ??
      (opts.accessCookie ? await readToken(opts.accessCookie) : null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit & { next?: { revalidate?: number } } = {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? "no-store",
  };
  if (opts.revalidate !== undefined) {
    init.next = { revalidate: opts.revalidate };
    delete init.cache; // revalidate und no-store schließen sich aus
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/v1${path}`, init);
  } catch {
    throw new ApiError(503, "Backend nicht erreichbar.");
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const detail =
      data && typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : `Fehler ${res.status}`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

/** Setzt Access- + Refresh-Cookie host-only. __Host-Regeln fest erzwungen:
 *  Secure (nur prod, damit dev über http funktioniert), KEIN Domain-Attribut
 *  (host-only → nicht über Subdomains teilbar, ADR-0015-Trennung), Path=/. */
export async function persistSession(
  session: SessionResponse,
  names: CookieNames,
): Promise<void> {
  requireName(names.access, "access");
  requireName(names.refresh, "refresh");
  const jar = await cookies();
  const common = {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax" as const,
    path: "/",
    // bewusst KEIN domain — host-only (ADR-0017 Sicherheitsgrenze).
  };
  jar.set(names.access, session.access_token, {
    ...common,
    maxAge: session.expires_in,
  });
  jar.set(names.refresh, session.refresh_token, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Löscht beide Session-Cookies (Logout). */
export async function clearSession(names: CookieNames): Promise<void> {
  requireName(names.access, "access");
  requireName(names.refresh, "refresh");
  const jar = await cookies();
  jar.delete(names.access);
  jar.delete(names.refresh);
}

/** Liest den `email`-Claim aus einem JWT (Base64url-Payload). NUR zum
 *  Vorausfüllen, nie als Vertrauensanker — der Server prüft die Signatur. */
export async function emailFromToken(token: string): Promise<string | null> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const claims = JSON.parse(json) as { email?: string };
    return claims.email ?? null;
  } catch {
    return null;
  }
}
