// API-Client für das FastAPI-Backend. Next.js ist reines Frontend — alle
// Business-Logik liegt in FastAPI (PROJECT.md §2). Dieser Client kapselt nur
// die HTTP-Aufrufe gegen /api/v1.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PREFIX = "/api/v1";

/** Basis-URL der API inkl. Präfix.
 *
 *  Für Aufrufe, die `api()` NICHT nutzen können — konkret Multipart-Uploads: der
 *  Browser muss dort den `Content-Type` samt Grenzmarkierung selbst setzen, ein
 *  von uns gesetztes `application/json` würde den Body unlesbar machen. Damit
 *  diese Aufrufe die Adresse nicht ein zweites Mal zusammenbauen (und beim
 *  nächsten Umzug vergessen werden), kommt sie von hier. */
export function apiBasis(): string {
  return `${BASE}${PREFIX}`;
}

export class ApiError extends Error {
  status: number;
  /**
   * Das rohe `detail` aus der Fehlerantwort, wenn es ein OBJEKT war.
   *
   * Manche Endpunkte tragen im Fehlerfall strukturierte Angaben, die der
   * Aufrufer braucht — etwa die Anzahl der Eigennutzungen, über die das
   * Löschen eines Eigentümers zurückfragt (409). Die aus dem Meldungstext zu
   * parsen wäre eine zweite, brüchige Wahrheit: der Text ist übersetzbar, die
   * Zahl nicht daraus rekonstruierbar.
   */
  details?: Record<string, unknown>;
  /**
   * Die Request-ID der Fehlerantwort (`X-Request-Id` bzw. `request_id` im
   * Body). Bei einem 500 ist sie das EINZIGE, was den Fehler auffindbar
   * macht: der Server sendet bewusst nur „internal_error" (kein
   * Stacktrace-Leak), hinterlegt die Ursache aber unter dieser ID.
   *
   * Sie wurde bis zum 01.09.2026 weggeworfen — die Oberflaeche zeigte
   * „internal_error" und niemand konnte sagen, woher er kam, obwohl Typ und
   * Codezeile im Server bereitlagen.
   */
  requestId?: string;
  constructor(
    message: string,
    status: number,
    details?: Record<string, unknown>,
    // `cause` durchreichen, damit die urspruengliche Ausnahme (undici-Fehler
    // mit ihrem `code`) am Fehler haengen bleibt statt verloren zu gehen.
    opts?: { cause?: unknown; requestId?: string },
  ) {
    super(message, opts);
    this.status = status;
    this.details = details;
    this.requestId = opts?.requestId;
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
  } catch (exc) {
    // Der EINZIGE Ort, an dem ein Netzwerkfehler des Backends entsteht — und
    // bis zum 31.08.2026 verschluckte er seine Ursache ersatzlos (`catch {}`).
    // Nach aussen stand dann „Backend nicht erreichbar." und sonst nichts:
    // gemeldet als „Upload Booking Buchungsliste funktioniert nicht", ohne
    // dass in irgendeinem Log stand, WARUM. undici verpackt den Grund in
    // `cause` (ECONNREFUSED, UND_ERR_HEADERS_TIMEOUT, ENOTFOUND, …) — genau
    // die Angabe, die den Unterschied zwischen „Dienst aus", „zu langsam" und
    // „falsche Adresse" ausmacht (Wurzel 5).
    const grund = exc instanceof Error ? exc : new Error(String(exc));
    // undici legt den Systemcode an `cause.code` ab — AUSSER wenn mehrere
    // Adressen versucht wurden (Host mit IPv4+IPv6): dann steht dort ein
    // AggregateError und die Codes haengen in `cause.errors[]`. Beide Wege
    // lesen, sonst bleibt genau im Mehrfach-Adressfall — dem Regelfall in
    // Docker — die Meldung wieder nichtssagend.
    const ursache = grund.cause as
      | { code?: unknown; errors?: { code?: unknown }[] }
      | undefined;
    const roh =
      ursache?.code ??
      ursache?.errors?.find((e) => typeof e?.code === "string")?.code;
    const code = typeof roh === "string" ? roh : undefined;
    console.error("[api] fetch fehlgeschlagen", {
      ziel: `${BASE}${PREFIX}${path}`,
      methode: opts.method ?? "GET",
      rumpfBytes:
        opts.body !== undefined ? JSON.stringify(opts.body).length : 0,
      fehler: grund.message,
      code,
    });
    // Der Code gehoert in die Meldung: „Backend nicht erreichbar." allein hat
    // den Betrieb ratlos gelassen. `cause` bleibt zusaetzlich erhalten, damit
    // ein Aufrufer die Urspruengliche Ausnahme noch auswerten kann.
    throw new ApiError(
      code ? `Backend nicht erreichbar (${code}).` : "Backend nicht erreichbar.",
      503,
      undefined,
      { cause: grund },
    );
  }

  if (!res.ok) {
    let detail = `Fehler ${res.status}`;
    let details: Record<string, unknown> | undefined;
    // Aus dem HEADER lesen, nicht nur aus dem Body: bei einer Antwort ohne
    // JSON (Gateway-Fehler, leerer Body) gibt es sonst gar keine Spur.
    let requestId = res.headers.get("X-Request-Id") || undefined;
    try {
      const data = await res.json();
      if (typeof data?.request_id === "string") requestId = data.request_id;
      if (typeof data?.detail === "string") {
        detail = data.detail;
      } else if (
        data?.detail &&
        typeof data.detail === "object" &&
        !Array.isArray(data.detail)
      ) {
        // Strukturiertes detail: die Meldung liegt in `message`, alles Weitere
        // (z. B. Anzahlen für eine Rückfrage) reicht `details` durch.
        details = data.detail as Record<string, unknown>;
        if (typeof details.message === "string") detail = details.message;
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
    throw new ApiError(detail, res.status, details, { requestId });
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
  role: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | "shift_lead" | null;
  capabilities: string[];
  permissions: string[];  // Feingranulare Berechtigungen (für UI-Gating)
  // Beherbergungsart des Mandanten (Migration 0090): steuert die Navigation.
  accommodation_type: AccommodationType | null;
  /** Vorfuehr-Mandant (0407): Oberflaeche zeigt das Demo-Band, Schreiben ist
   *  serverseitig abgeschaltet. */
  is_demo?: boolean;
  /** Internes Test-/Vorfuehrkonto des Hauses (`tenants.is_internal`, 0505):
   *  schaltet Module frei, die noch in Entwicklung sind (derzeit die
   *  Buchhaltung). NICHT `is_demo` — das ist die anonyme Schaufenster-
   *  Vorfuehrung und sperrt Schreibzugriffe samt Buchhaltung. */
  is_internal?: boolean;
  /** Freigeschaltete, noch nicht allgemein verfuegbare Module (0572).
   *  Leer = nur die allgemein verfuegbaren Bereiche. */
  enabled_modules?: string[];
  // Standardsprache des BETRIEBS (Migration 0335): zweite Stufe der
  // Mail-Sprachkette (eigene Wahl → Betrieb → Englisch). Sie gilt für jeden
  // Empfänger ohne eigene Sprachwahl. null = nicht erfasst → Englisch; das ist
  // eine ehrliche Auskunft und KEIN Anlass, „de" anzunehmen (Wurzel 4).
  default_language: string | null;
  // FIRMENSITZ des Betriebs (`tenants.country`, ISO-3166-1 alpha-2). Steuert,
  // welche länderspezifischen Werkzeuge sichtbar sind (lib/laender-funktionen).
  // Ausdrücklich NICHT die Anzeigesprache: der Beta-Betrieb sitzt in Dänemark
  // und arbeitet auf Deutsch. null = nicht erfasst → länderspezifische Punkte
  // bleiben verborgen, statt ein Land zu raten (Wurzel 4).
  country: string | null;
  /** Name des Betriebs (`tenants.name`), eingegeben bei der Registrierung.
   *  Der Onboarding-Assistent belegt damit „Firmenname" vor — sonst tippt ein
   *  frisch registrierter Betrieb denselben Namen ein zweites Mal, weil die
   *  eigentliche Quelle (`tenant_billing_profile`) noch leer ist. */
  tenant_name: string | null;
  /** Firmenlogo des Betriebs (`tenant_billing_profile.company_logo_url`),
   *  hochgeladen unter Konto → Profil. null = keins hinterlegt; die Oberfläche
   *  zeigt dann ihr Ersatzzeichen. */
  tenant_logo_url: string | null;
};
