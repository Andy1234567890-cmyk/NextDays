"use server";

// Gastgeber-Auth als Server Actions (Cookie SETZEN geht nur hier, nicht in Server
// Components — ADR-0015). Eigenes host-only Cookie __Host-nd_host, getrennt von
// der Gast-App. Business-Logik bleibt in FastAPI (auth-Slice); diese Actions
// schreiben nur die Session-Cookies und rufen das Backend server-zu-server.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  ApiError,
  HOST_ACCESS_COOKIE,
  HOST_REFRESH_COOKIE,
} from "./api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PROD = process.env.NODE_ENV === "production";

export type MeResponse = {
  user_id: string;
  email: string | null;
  tenant_id: string | null;
  role: string | null;
  capabilities: string[];
  permissions: string[];
  accommodation_type: string | null;
  account_type: string | null;
};

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};
type LoginResponse = {
  mfa_required: boolean;
  session: SessionResponse | null;
  mfa_token: string | null;
};

// Auth-Endpunkte SETZEN Cookies → sie laufen server-zu-server hier (nicht über
// den DAL, der nur liest). Eigener schlanker fetch mit Fehler-Mapping.
async function backend<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BACKEND}/api/v1${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
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

async function persistSession(session: SessionResponse): Promise<void> {
  const jar = await cookies();
  // host-only (kein domain-Attribut, ADR-0015) — nie an die Gast-Domain.
  const common = {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax" as const,
    path: "/",
  };
  jar.set(HOST_ACCESS_COOKIE, session.access_token, {
    ...common,
    maxAge: session.expires_in,
  });
  jar.set(HOST_REFRESH_COOKIE, session.refresh_token, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
}

type LoginResult =
  | { ok: true; mfaRequired?: false }
  | { ok: true; mfaRequired: true; mfaToken: string }
  | { ok: false; error: string };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await backend<LoginResponse>("/auth/login", { email, password });
    if (res.mfa_required && res.mfa_token) {
      return { ok: true, mfaRequired: true, mfaToken: res.mfa_token };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Login fehlgeschlagen.",
    };
  }
}

export async function loginTotp(
  mfaToken: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await backend<LoginResponse>("/auth/login/totp", {
      mfa_token: mfaToken,
      code,
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Code ist ungültig.",
    };
  }
}

/** Gastgeber-Registrierung: Tenant+Admin mit account_type='marketplace'
 *  (8%-Fee-Modell, KEIN Abo). Meldet direkt an. */
export async function registerHost(input: {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  country: string;
  currency: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await backend<SessionResponse>("/auth/register", {
      email: input.email,
      password: input.password,
      full_name: input.fullName,
      tenant_name: input.tenantName,
      country: input.country,
      currency: input.currency,
      business_type: "self_managed",
      account_type: "marketplace",
    });
    await persistSession(session);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError ? exc.message : "Registrierung fehlgeschlagen.",
    };
  }
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(HOST_ACCESS_COOKIE);
  jar.delete(HOST_REFRESH_COOKIE);
  revalidatePath("/", "layout");
}
