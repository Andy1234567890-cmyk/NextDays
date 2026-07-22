/**
 * API-Client für den Buchhaltungs-Bestand.
 *
 * Signatur-kompatibel zum ursprünglichen Tasko-Client (`api.get/post/put/patch/
 * delete/upload`, `apiClient<T>()`), damit die übernommenen Komponenten/Services
 * UNVERÄNDERT bleiben. Die Implementierung zeigt auf das NextDays-FastAPI.
 *
 * Token-Anschluss: aktuell wird der Bearer-Token aus dem NextDays-Session-Cookie
 * gelesen (client-seitig). Der vollständige Auth-Anschluss (Refresh/Session) wird
 * im Backend-Schritt sauber verdrahtet — siehe Plan „Backend danach".
 */

// Leere Basis = eigener Origin (localhost:3000). Die Requests treffen den
// Next.js-Proxy unter app/api/v1/[...path], der das httpOnly-Session-Token
// server-seitig injiziert und an FastAPI weiterreicht. So funktioniert Auth
// ohne dass der Browser das httpOnly-Cookie selbst lesen müsste.
const API_URL = "";

interface ApiOptions extends RequestInit {
  requiresAuth?: boolean;
  skipRefresh?: boolean;
}

/**
 * Übersetzt die Endpoint-Pfade des Buchhaltungs-Bestands auf das NextDays-
 * FastAPI: Der Bestand ruft `/api/v1/invoices/...` (und Kunden) auf; im
 * NextDays-Backend leben diese unter dem `buchhaltung`-Slice
 * (`/api/v1/buchhaltung/...`). So bleibt der Bestands-Code unverändert.
 */
function mapEndpoint(endpoint: string): string {
  return endpoint
    .replace("/api/v1/invoices", "/api/v1/buchhaltung/invoices")
    .replace("/api/v1/customers", "/api/v1/buchhaltung/customers")
    .replace("/api/v1/booking-accounts", "/api/v1/buchhaltung/booking-accounts")
    .replace("/api/v1/quotes", "/api/v1/buchhaltung/quotes")
    .replace("/api/v1/companies", "/api/v1/buchhaltung/companies")
    .replace("/api/v1/number-sequences", "/api/v1/buchhaltung/number-sequences")
    .replace(
      "/api/v1/inline-invoice-services",
      "/api/v1/buchhaltung/inline-invoice-services",
    )
    .replace("/api/v1/text-templates", "/api/v1/buchhaltung/text-templates")
    .replace("/api/v1/users", "/api/v1/buchhaltung/users");
}

/**
 * Zentrale Request-Funktion: Fehlerbehandlung, JSON/Text-Parsing.
 * Verhalten 1:1 zum Tasko-Client (FastAPI-`detail`-Fehler werden ausgepackt).
 * Der Bearer-Token wird NICHT hier injiziert, sondern server-seitig vom
 * Next.js-Proxy (app/api/v1/[...path]) aus dem httpOnly-Cookie.
 */
export async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { requiresAuth: _requiresAuth = true, skipRefresh: _skipRefresh = false, ...fetchOptions } =
    options;

  const isFormData = fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${mapEndpoint(endpoint)}`, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      const detail = errorData.detail;
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail
          .map((e: { msg?: string }) => e.msg || JSON.stringify(e))
          .join(", ");
      } else if (detail !== null && detail !== undefined) {
        errorMessage = JSON.stringify(detail);
      } else {
        errorMessage = errorData.message || errorMessage;
      }
    } catch {
      // Fehlerantwort nicht parsebar — Standardmeldung behalten.
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text() as unknown as T;
}

/** Komfort-Methoden für gängige HTTP-Operationen (Signatur 1:1 zum Tasko-Client). */
export const api = {
  get: <T>(endpoint: string, options?: ApiOptions) =>
    apiClient<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: unknown, options?: ApiOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: ApiOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: ApiOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: ApiOptions) =>
    apiClient<T>(endpoint, { ...options, method: "DELETE" }),

  upload: <T>(endpoint: string, formData: FormData, options?: ApiOptions) =>
    apiClient<T>(endpoint, { ...options, method: "POST", body: formData }),
};
