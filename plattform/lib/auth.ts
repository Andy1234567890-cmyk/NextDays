"use server";

// Gastgeber-Auth für die Plattform (eigener Flow, getrennt von apps/web).
// Registrierung setzt account_type='marketplace' → 8%-Fee-Modell statt Abo.
// Session als httpOnly-Cookie nd_access/nd_refresh (dasselbe Cookie, das der
// Proxy als Bearer injiziert). Business-Logik bleibt in FastAPI (auth-Slice).
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ACCESS = "nd_access";
const REFRESH = "nd_refresh";

export type SessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};
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
type LoginResponse = {
  mfa_required: boolean;
  session: SessionResponse | null;
  mfa_token: string | null;
};

class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function backend<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BACKEND}/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new BackendError(
      res.status,
      (data && typeof data.detail === "string" && data.detail) ||
        `Fehler ${res.status}`,
    );
  }
  return data as T;
}

async function persistSession(session: SessionResponse): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(ACCESS, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: session.expires_in,
  });
  jar.set(REFRESH, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

type LoginResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: true; mfaRequired: true; mfaToken: string };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await backend<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (res.mfa_required && res.mfa_token) {
      return { ok: true, mfaRequired: true, mfaToken: res.mfa_token };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof BackendError ? exc.message : "Login fehlgeschlagen.",
    };
  }
}

export async function loginTotp(
  mfaToken: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await backend<LoginResponse>("/auth/login/totp", {
      method: "POST",
      body: { mfa_token: mfaToken, code },
    });
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof BackendError ? exc.message : "Code ist ungültig.",
    };
  }
}

/** Gastgeber-Registrierung: erzeugt Tenant+Admin mit account_type='marketplace'
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
      method: "POST",
      body: {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        tenant_name: input.tenantName,
        country: input.country,
        currency: input.currency,
        // Einzelvermieter, der selbst listet (kein Agentur-Owner-Statement).
        business_type: "self_managed",
        // DAS unterscheidet den Plattform-Gastgeber vom PMS-Betrieb.
        account_type: "marketplace",
      },
    });
    await persistSession(session);
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof BackendError
          ? exc.message
          : "Registrierung fehlgeschlagen.",
    };
  }
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
  revalidatePath("/", "layout");
}

export async function getMe(): Promise<MeResponse | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS)?.value;
  if (!token) return null;
  try {
    return await backend<MeResponse>("/auth/me", { token });
  } catch {
    return null;
  }
}
