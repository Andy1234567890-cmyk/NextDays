// API-Client für das FastAPI-Backend (gleiche /api/v1-Schnittstelle wie die
// Web-App). Business-Logik bleibt im Backend; die App ruft nur HTTP. URL/Env
// ausschließlich aus lib/config. Bei 401 wird GENAU EINMAL still refresht und
// der Request wiederholt (CLAUDE.md Mobile: kein Retry-Loop).
import { getToken, refreshSession } from "@/lib/auth";
import { CONFIG } from "@/lib/config";

const BASE = CONFIG.apiUrl;
const PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /**
   * JSON-Nutzlast — ODER ein `FormData` für Datei-Uploads (Foto-Nachweise an
   * Aufgaben). Bei FormData wird NICHT serialisiert und KEIN Content-Type
   * gesetzt: die Boundary bestimmt die Laufzeit, ein selbst gesetzter Header
   * ohne Boundary lässt den Upload serverseitig als leeres Feld ankommen.
   */
  body?: unknown;
};

// Auth-Pfade dürfen NICHT den 401→Refresh→Retry-Zyklus auslösen (sonst
// Rekursion: /auth/refresh, das 401 gibt, würde erneut refreshen; ein 401 aus
// login/register ist eine fachliche Antwort, kein Session-Ablauf).
function isAuthPath(path: string): boolean {
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/refresh")
  );
}

async function doFetch<T>(path: string, opts: Options): Promise<T> {
  const token = await getToken();
  // Content-Type braucht Bracket-Notation (Bindestrich im Header-Namen).
  const headers: Record<string, string> = {};
  const istFormData =
    typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !istFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${PREFIX}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: istFormData
        ? (opts.body as FormData)
        : opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
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
      // kein JSON-Body
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Roher Aufruf — wirft ApiError. Nutze `call` für ein Result.
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  try {
    return await doFetch<T>(path, opts);
  } catch (exc) {
    // Genau EIN Refresh-Versuch bei 401 (nicht auf Auth-Pfaden selbst), dann
    // Request einmal wiederholen. Schlägt der Refresh fehl → 401 bleibt.
    if (exc instanceof ApiError && exc.status === 401 && !isAuthPath(path)) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return doFetch<T>(path, opts);
      }
    }
    throw exc;
  }
}

// Bequemer Wrapper: nie werfen, immer ein Result zurückgeben.
export async function call<T>(path: string, opts: Options = {}): Promise<Result<T>> {
  try {
    return { ok: true, data: await api<T>(path, opts) };
  } catch (exc) {
    return { ok: false, error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen." };
  }
}
