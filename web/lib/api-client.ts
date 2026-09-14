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
// Alte Taskilo-Pfade → unser Buchhaltungs-Slice. Der Bestand ruft
// `/api/v1/expenses`, `/api/v1/reminders` … genau wie im alten Backend; bei
// uns liegt ALLES davon unter `/api/v1/buchhaltung/<alter Pfad>` (Modul-Riegel
// `auth/modul_freischaltung.py` greift so über den einen Präfix). Tabelle statt
// Kette von `.replace`: bis zum 11.09.2026 stand hier eine Kette aus neun
// Ersetzungen, und `/finance/customers` fiel durch, weil `/api/v1/customers`
// kein Teilstring davon ist — die Kundensuche im Mailversand lief ins 404.
// Ein Segment, das NICHT hier steht, geht unverändert an FastAPI — und dort ins
// 404. Neue Bereiche tragen sich hier ein, nicht mit einer weiteren Ersetzung.
const BUCHHALTUNG_SEGMENTE: ReadonlySet<string> = new Set([
  "bank-transactions",
  "booking-accounts",
  "cashbook",
  "cost-centers",
  "companies",
  "contacts",
  "customers",
  "datev",
  "delivery-notes",
  "documents",
  "einvoice",
  "einvoices",
  "email",
  "expenses",
  "finapi",
  "fixed-assets",
  "gobd",
  "inline-invoice-services",
  "inventory",
  "invoices",
  "items",
  "number-sequences",
  "order-confirmations",
  "payment-accounts",
  "payment-methods",
  "quotes",
  "recurring-invoices",
  "reminders",
  "reports",
  "send-invoice-email",
  "suppliers",
  "tax",
  "tax-reports",
  "text-templates",
  "transaction-links",
  "users",
]);

export function mapEndpoint(endpoint: string): string {
  // Der ältere Bestand (EmailSendModal) sucht Kunden unter `/finance/customers`.
  const pfad = endpoint
    .replace(/^\/api\/v1\/finance\/customers/, "/api/v1/customers")
    // finAPI hing alt ohne Versionspräfix unter `/api/finapi`.
    .replace(/^\/api\/finapi(?=\/|$)/, "/api/v1/finapi");
  const treffer = /^\/api\/v1\/([a-z-]+)(?=\/|\?|$)/.exec(pfad);
  if (!treffer || treffer[1] === "buchhaltung" || !BUCHHALTUNG_SEGMENTE.has(treffer[1])) {
    return pfad;
  }
  return pfad.replace("/api/v1/", "/api/v1/buchhaltung/");
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
