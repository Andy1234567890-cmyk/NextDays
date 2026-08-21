// Technischer Inhalt der Entwickler-Dokumentation — SPRACHNEUTRAL.
//
// Warum das nicht in `messages/<locale>.json` steht: Endpunkt-Pfade,
// Feldnamen, HTTP-Methoden, Scope-Namen, Header und curl-Beispiele sind KEINE
// Sprache, sondern Schnittstelle. Sie in 24 Sprachdateien zu kopieren hieße,
// 24 Kopien eines Vertrags zu pflegen, von denen 23 beim nächsten neuen
// Endpunkt veralten — und ein übersetzter Feldname wäre ein Fehler, kein
// Service. Übersetzt wird deshalb nur die ERKLÄRUNG (Rahmentexte über
// `useTranslations`), nicht der Vertrag.
//
// EINE WAHRHEIT: Die Endpunktliste hier ist eine LESEHILFE, nicht die Quelle.
// Die Quelle ist die OpenAPI-Datei, die der Service selbst ausliefert
// (`https://api.mynextdays.dk/openapi.json`) — sie entsteht aus dem Code und
// kann deshalb nicht veralten. Deshalb ist diese Seite bewusst eine ANLEITUNG
// mit Verweis auf die interaktive Referenz und keine zweite, handgepflegte
// Endpunktdokumentation. Wer einen Endpunkt ergänzt, prüft hier höchstens die
// Gruppen-Übersicht; die Details holt sich der Leser aus dem Schema.

/** Basis-Adresse der öffentlichen API. */
export const API_BASIS = "https://api.mynextdays.dk";

/** Die drei Adressen, die ein Entwickler zuerst braucht. */
export const API_LINKS = {
  /** Interaktive Referenz mit „Ausprobieren"-Konsole (Swagger UI). */
  konsole: `${API_BASIS}/docs`,
  /** Ruhigere Lesefassung derselben Datei (Redoc). */
  referenz: `${API_BASIS}/referenz`,
  /** Die OpenAPI-3.1-Datei selbst — Grundlage für Client-Generatoren. */
  schema: `${API_BASIS}/openapi.json`,
} as const;

/** Aktuelle Version im Pfad. */
export const API_VERSION = "v1";

export type EndpunktGruppe = {
  /** Übersetzungsschlüssel für Titel und Beschreibung der Gruppe. */
  key: string;
  scopes: readonly string[];
  endpunkte: readonly { methode: string; pfad: string; zweck: string }[];
};

/**
 * Gruppen-Übersicht. `zweck` ist absichtlich ein kurzer deutscher Halbsatz und
 * NICHT übersetzt: die Zeile daneben trägt Methode und Pfad, und wer eine API
 * anbindet, liest ohnehin die englische Referenz. Eine 24-fach übersetzte
 * Endpunkttabelle wäre 24-fach veraltet.
 */
export const ENDPUNKT_GRUPPEN: readonly EndpunktGruppe[] = [
  {
    key: "auth",
    scopes: [],
    endpunkte: [
      { methode: "POST", pfad: "/v1/oauth/token", zweck: "Access-Token holen" },
      { methode: "GET", pfad: "/v1/me", zweck: "Scopes und Objekte dieses Zugangs" },
    ],
  },
  {
    key: "objekte",
    scopes: ["properties:read", "properties:write"],
    endpunkte: [
      { methode: "GET", pfad: "/v1/properties", zweck: "Objekte auflisten" },
      { methode: "GET", pfad: "/v1/properties/{id}", zweck: "Ein Objekt lesen" },
      {
        methode: "GET",
        pfad: "/v1/properties/{id}/units",
        zweck: "Einheiten des Typs",
      },
      { methode: "PATCH", pfad: "/v1/properties/{id}", zweck: "Objekt ändern" },
    ],
  },
  {
    key: "verfuegbarkeit",
    scopes: ["availability:read", "availability:write"],
    endpunkte: [
      {
        methode: "GET",
        pfad: "/v1/availability",
        zweck: "Freie Einheiten je Tag oder Zeitraum",
      },
      {
        methode: "PUT",
        pfad: "/v1/availability",
        zweck: "Nächte sperren, freigeben, Verkauf stoppen",
      },
    ],
  },
  {
    key: "preise",
    scopes: ["rates:read", "rates:write"],
    endpunkte: [
      { methode: "GET", pfad: "/v1/rate-plans", zweck: "Rate-Pläne eines Objekts" },
      {
        methode: "GET",
        pfad: "/v1/rates",
        zweck: "Tagespreise und Aufenthaltsregeln lesen",
      },
      {
        methode: "PUT",
        pfad: "/v1/rates",
        zweck: "Tagespreise und Regeln setzen",
      },
    ],
  },
  {
    key: "buchungen",
    scopes: ["reservations:read", "reservations:write"],
    endpunkte: [
      { methode: "GET", pfad: "/v1/reservations", zweck: "Buchungen auflisten" },
      {
        methode: "GET",
        pfad: "/v1/reservations/{id}",
        zweck: "Eine Buchung lesen",
      },
      { methode: "POST", pfad: "/v1/reservations", zweck: "Buchung anlegen" },
    ],
  },
  {
    key: "gaeste",
    scopes: ["guests:read"],
    endpunkte: [
      { methode: "GET", pfad: "/v1/guests", zweck: "Gäste auflisten" },
      { methode: "GET", pfad: "/v1/guests/{id}", zweck: "Einen Gast lesen" },
    ],
  },
  {
    key: "aufgaben",
    scopes: ["tasks:read", "tasks:write"],
    endpunkte: [
      { methode: "GET", pfad: "/v1/tasks", zweck: "Aufgaben auflisten" },
      { methode: "GET", pfad: "/v1/tasks/{id}", zweck: "Eine Aufgabe lesen" },
      { methode: "POST", pfad: "/v1/tasks", zweck: "Aufgabe anlegen" },
      { methode: "PATCH", pfad: "/v1/tasks/{id}", zweck: "Aufgabe ändern" },
    ],
  },
  {
    key: "webhooks",
    scopes: ["webhooks:read", "webhooks:write"],
    endpunkte: [
      { methode: "GET", pfad: "/v1/webhooks/events", zweck: "Ereignis-Katalog" },
      { methode: "GET", pfad: "/v1/webhooks", zweck: "Eigene Abos" },
      { methode: "POST", pfad: "/v1/webhooks", zweck: "Abo anlegen" },
      { methode: "DELETE", pfad: "/v1/webhooks/{id}", zweck: "Abo beenden" },
    ],
  },
] as const;

/**
 * Ereignis-Katalog. Deckungsgleich mit `EREIGNISSE` in
 * `apps/public-api/src/v1/schemas.py` — dort ist die Wahrheit (dagegen wird ein
 * Abo validiert). Die Liste hier ist die Leseform; ein Ereignis, das nur hier
 * steht, kann niemand abonnieren, also wird sie beim Ergänzen mitgezogen.
 */
export const EREIGNISSE: readonly { name: string; key: string }[] = [
  { name: "reservation.created", key: "reservationCreated" },
  { name: "reservation.updated", key: "reservationUpdated" },
  { name: "reservation.cancelled", key: "reservationCancelled" },
  { name: "availability.changed", key: "availabilityChanged" },
  { name: "rate.changed", key: "rateChanged" },
  { name: "task.created", key: "taskCreated" },
  { name: "task.completed", key: "taskCompleted" },
] as const;

/** Rate-Limits, wie der Service sie ausliefert (Standardwerte). */
export const RATE_LIMITS: readonly {
  eimer: string;
  wert: string;
  key: string;
}[] = [
  { eimer: "token", wert: "10 / min", key: "token" },
  { eimer: "write", wert: "120 / min", key: "write" },
  { eimer: "read", wert: "600 / min", key: "read" },
] as const;

/** Die Header, die jede Antwort trägt. */
export const LIMIT_HEADER = [
  "RateLimit-Limit",
  "RateLimit-Remaining",
  "RateLimit-Reset",
] as const;

/** Fehlercodes, auf die ein Client sinnvoll verzweigt. Stabil. */
export const FEHLER_CODES: readonly {
  code: string;
  status: number;
  key: string;
}[] = [
  { code: "nicht_authentifiziert", status: 401, key: "nichtAuthentifiziert" },
  { code: "ungueltige_zugangsdaten", status: 401, key: "ungueltigeZugangsdaten" },
  { code: "scope_fehlt", status: 403, key: "scopeFehlt" },
  { code: "objekt_nicht_erlaubt", status: 403, key: "objektNichtErlaubt" },
  { code: "nicht_gefunden", status: 404, key: "nichtGefunden" },
  { code: "zeitraum_nicht_verfuegbar", status: 409, key: "zeitraumNichtVerfuegbar" },
  { code: "idempotenz_in_arbeit", status: 409, key: "idempotenzInArbeit" },
  { code: "abo_besteht_bereits", status: 409, key: "aboBestehtBereits" },
  { code: "waehrung_fehlt", status: 422, key: "waehrungFehlt" },
  { code: "ungueltige_anfrage", status: 422, key: "ungueltigeAnfrage" },
  { code: "validierung_fehlgeschlagen", status: 422, key: "validierungFehlgeschlagen" },
  { code: "zu_viele_anfragen", status: 429, key: "zuVieleAnfragen" },
  { code: "nicht_konfiguriert", status: 503, key: "nichtKonfiguriert" },
] as const;

// -- Code-Beispiele ---------------------------------------------------------
// Bewusst curl: es läuft überall, setzt keine Bibliothek voraus und lässt sich
// kopieren. Sprachspezifische Beispiele (Python, Node) kommen erst, wenn es
// SDKs gibt — ein handgeschriebenes Beispiel je Sprache veraltet dreifach.

export const BEISPIEL_TOKEN = `curl -X POST ${API_BASIS}/v1/oauth/token \\
  -H 'Content-Type: application/json' \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "mnd_live_id_…",
    "client_secret": "mnd_live_…"
  }'`;

export const BEISPIEL_TOKEN_ANTWORT = `{
  "access_token": "eyJhbGciOiJIUzI1NiIs…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "properties:read availability:read reservations:read"
}`;

export const BEISPIEL_OBJEKTE = `curl ${API_BASIS}/v1/properties \\
  -H 'Authorization: Bearer <access_token>'`;

export const BEISPIEL_OBJEKTE_ANTWORT = `{
  "data": [
    {
      "id": "8f14e45f-…",
      "title": "Feriehus Kornblomst",
      "status": "active",
      "currency": "DKK",
      "timezone": "Europe/Copenhagen",
      "units_total": 1,
      "max_guests": 6,
      "channels": { "marketplace": true, "website": false }
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "has_more": false }
}`;

export const BEISPIEL_VERFUEGBARKEIT = `curl '${API_BASIS}/v1/availability\\
?property_id=8f14e45f-…&from=2026-09-01&to=2026-09-30' \\
  -H 'Authorization: Bearer <access_token>'`;

export const BEISPIEL_VERFUEGBARKEIT_ANTWORT = `{
  "property_id": "8f14e45f-…",
  "granularity": "spans",
  "data": [
    { "from": "2026-09-01", "to": "2026-09-11", "units_available": 1 },
    { "from": "2026-09-12", "to": "2026-09-19", "units_available": 0 },
    { "from": "2026-09-20", "to": "2026-09-30", "units_available": 1 }
  ]
}`;

export const BEISPIEL_PREIS = `curl -X PUT ${API_BASIS}/v1/rates \\
  -H 'Authorization: Bearer <access_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "rate_plan_id": "a3f1c2…",
    "from": "2026-12-20",
    "to": "2027-01-03",
    "price": 1850,
    "min_stay": 5,
    "weekdays": [5, 6]
  }'`;

export const BEISPIEL_BUCHUNG = `curl -X POST ${API_BASIS}/v1/reservations \\
  -H 'Authorization: Bearer <access_token>' \\
  -H 'Idempotency-Key: 8f9a1c30-6b1e-4d2a-9f77-4e0c1b2d3a55' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "property_id": "8f14e45f-…",
    "check_in": "2026-09-10",
    "check_out": "2026-09-13",
    "total_amount": 4500,
    "currency": "DKK",
    "adults": 2,
    "guest": {
      "first_name": "Jens",
      "last_name": "Hansen",
      "email": "jens@example.dk"
    }
  }'`;

export const BEISPIEL_FEHLER = `{
  "type": "https://developers.mynextdays.dk/errors/zeitraum_nicht_verfuegbar",
  "title": "Konflikt",
  "status": 409,
  "detail": "Der Zeitraum ist belegt, gesperrt oder vom Verkauf ausgenommen. Es wurde keine Buchung angelegt.",
  "instance": "/v1/reservations",
  "code": "zeitraum_nicht_verfuegbar",
  "request_id": "3f1a9c7e4b2d48f0a1c5",
  "check_in": "2026-09-10",
  "check_out": "2026-09-13"
}`;

export const BEISPIEL_WEBHOOK_ANLEGEN = `curl -X POST ${API_BASIS}/v1/webhooks \\
  -H 'Authorization: Bearer <access_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "url": "https://meine-anwendung.de/haken/mynextdays",
    "events": ["reservation.created", "reservation.cancelled"]
  }'`;

export const BEISPIEL_WEBHOOK_NUTZLAST = `{
  "id": "b7c9e1a2-…",
  "event": "reservation.created",
  "created_at": "2026-08-21T09:14:02.418Z",
  "property_id": "8f14e45f-…",
  "data": {
    "reservation_id": "d41d8cd9-…",
    "property_id": "8f14e45f-…",
    "unit_id": "1c3b5a7d-…",
    "status": "confirmed",
    "channel": "booking",
    "check_in": "2026-09-10",
    "check_out": "2026-09-13",
    "booked_at": "2026-08-20T18:33:11Z",
    "received_at": "2026-08-21T09:14:01Z"
  }
}`;

/**
 * Signaturprüfung. Node, weil der Empfänger einer Webhook-Zustellung fast
 * immer ein Web-Backend ist — und weil die zwei Fallen (rohen Body verwenden,
 * zeitkonstant vergleichen) sich in JavaScript besonders leicht übersehen.
 */
export const BEISPIEL_SIGNATUR_PRUEFEN = `import crypto from "node:crypto";

// WICHTIG: den ROHEN Body verwenden, nicht das geparste Objekt. Ein
// re-serialisiertes JSON hat eine andere Byte-Folge und damit eine andere
// Signatur — der häufigste Grund für „Signatur passt nicht".
export function signaturPruefen(rohBody, header, secret) {
  const teile = new Map(
    header.split(",").map((t) => t.split("=").map((s) => s.trim())),
  );
  const t = teile.get("t");
  const empfangen = teile.get("v1");
  if (!t || !empfangen) return false;

  // Alter der Zustellung prüfen: der Zeitstempel ist mitsigniert, damit eine
  // aufgezeichnete Zustellung nicht später erneut eingespielt werden kann.
  const alterSekunden = Math.abs(Date.now() / 1000 - Number(t));
  if (alterSekunden > 300) return false;

  const erwartet = crypto
    .createHmac("sha256", secret)
    .update(\`\${t}.\${rohBody}\`)
    .digest("hex");

  // Zeitkonstanter Vergleich — ein == würde die Signatur erratbar machen.
  return crypto.timingSafeEqual(
    Buffer.from(erwartet),
    Buffer.from(empfangen),
  );
}`;
