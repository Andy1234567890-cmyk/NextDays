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
      if (typeof data?.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data?.detail)) {
        // Pydantic-Validierungsfehler: Array aus {loc, msg, …} — die msg-Texte
        // sichtbar machen statt nur „Fehler 422" (der Nutzer muss den Grund sehen).
        const msgs = data.detail
          .map((e: { msg?: string; loc?: (string | number)[] }) => {
            const field = e.loc?.slice(1).join(".") || "";
            return field && e.msg ? `${field}: ${e.msg}` : e.msg || "";
          })
          .filter(Boolean);
        if (msgs.length) detail = msgs.join(" · ");
      }
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

export type AccommodationType = "vacation_rental" | "hotel";

export type MeResponse = {
  user_id: string;
  email: string | null;
  tenant_id: string | null;
  role: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | null;
  capabilities: string[];
  permissions: string[];  // Feingranulare Berechtigungen (für UI-Gating)
  // Beherbergungsart des Mandanten (Migration 0090): steuert die Navigation.
  accommodation_type: AccommodationType | null;
  // Standardsprache des BETRIEBS (Migration 0335): zweite Stufe der
  // Mail-Sprachkette (eigene Wahl → Betrieb → Englisch). Sie gilt für jeden
  // Empfänger ohne eigene Sprachwahl. null = nicht erfasst → Englisch; das ist
  // eine ehrliche Auskunft und KEIN Anlass, „de" anzunehmen (Wurzel 4).
  default_language: string | null;
};
