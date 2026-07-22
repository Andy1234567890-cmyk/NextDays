// Zentraler Data Access Layer (Gastgeber-Dashboard). EINZIGE Stelle, die das
// Session-Cookie serverseitig liest und als Bearer an die FastAPI hängt.
//
// Modernes App-Router-Muster (belegt, ADR-0015): KEIN same-origin Proxy-Route-
// Handler. Server Components (Lesen) und Server Actions (Schreiben) rufen diese
// Helfer auf; die laufen ausschließlich auf dem Server, lesen das httpOnly-Cookie
// via cookies() und fetchen FastAPI DIREKT (server-zu-server). Der Token landet
// nie im Browser-JS (BFF-Prinzip → XSS-sicher).
import { cookies } from "next/headers";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// host-only Cookie des Gastgebers (getrennt vom Gast-Cookie, ADR-0015). __Host-
// erzwingt Secure — lokal (http) daher schlichter Name, damit dev funktioniert.
const PROD = process.env.NODE_ENV === "production";
export const HOST_ACCESS_COOKIE = PROD ? "__Host-nd_host" : "nd_host";
export const HOST_REFRESH_COOKIE = PROD
  ? "__Host-nd_host_refresh"
  : "nd_host_refresh";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Access-Token des eingeloggten Gastgebers (oder null). */
export async function hostToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(HOST_ACCESS_COOKIE)?.value ?? null;
}

type CallOpts = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** GET-Cache-Verhalten. Default no-store (frische, gescopte Daten). Für stabile
   *  Stammdaten kann der Aufrufer next.revalidate setzen. */
  cache?: RequestCache;
  revalidate?: number;
  /** Öffentliche Endpunkte (kein Login nötig) → ohne Bearer. */
  public?: boolean;
};

/** Ein Backend-Call server-zu-server mit Bearer aus dem Host-Cookie.
 *  Wirft ApiError bei !ok. NUR aus Server Components / Server Actions aufrufen. */
export async function api<T>(path: string, opts: CallOpts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!opts.public) {
    const token = await hostToken();
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
