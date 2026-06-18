// API-Client für das FastAPI-Backend. Next.js ist reines Frontend — alle
// Business-Logik liegt in FastAPI (PROJECT.md §2). Dieser Client kapselt nur
// die HTTP-Aufrufe gegen /api/v1.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer-Token (Server-seitig aus dem Cookie gelesen). */
  token?: string;
  /** Next.js-Fetch-Cache-Verhalten. */
  cache?: RequestCache;
};

/** Ruft einen FastAPI-Endpunkt unter /api/v1 auf und gibt das JSON zurück. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${PREFIX}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: opts.cache ?? "no-store",
    });
  } catch {
    throw new ApiError("Backend nicht erreichbar.", 503);
  }

  if (!res.ok) {
    let detail = `Fehler ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // kein JSON-Body — Standardmeldung behalten
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Typen, gespiegelt aus den FastAPI-Schemas (auth-Slice) ---

export type SessionResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type MeResponse = {
  user_id: string;
  email: string | null;
  tenant_id: string | null;
  role: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | null;
  capabilities: string[];
};
