// Geteilte Security-Header für Next-15-App-Router-Frontends (ADR-0016, Wurzel 4).
//
// AUFTEILUNG (belegt, Doppelung vermeiden): die generischen, wertgleichen Header
// (Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy,
// Permissions-Policy) setzt der TLS-terminierende Traefik-Proxy GLOBAL — NICHT
// hier, sonst entstehen Duplikate (Browser wenden dann unvorhersehbar an). Hier
// leben nur die INHALTSABHÄNGIGEN Header, die jede App selbst kennt: die CSP und
// X-Frame-Options.
//
// CSP-Linie: pragmatisch. Next 15 App Router injiziert bei der Hydration Inline-
// Bootstrap-Scripts, für die es im App Router keinen automatischen Nonce-Weg auf
// statisch gerenderten Seiten gibt → 'unsafe-inline' bei script-src/style-src ist
// in der Praxis Pflicht, sonst weiße Seite. Das blockt trotzdem FREMDE Script-
// Quellen. Die eigentliche Auth-Boundary liegt serverseitig (FastAPI + RLS); die
// CSP ist hier XSS-Tiefenverteidigung, nicht die Primärkontrolle.

export interface CspOptions {
  /** API-Host(s) für connect-src (Server Actions / fetch zum Backend). Ohne
   *  Schema, z. B. "api.mynextdays.com". 'self' ist immer enthalten. */
  connectHosts?: string[];
  /** frame-ancestors. Default 'none' (nicht einbettbar). builder überschreibt
   *  das für White-Label-Embeds. */
  frameAncestors?: string;
  /** Dev-Modus braucht 'unsafe-eval' (React-Debugging). In Prod NIE. */
  dev?: boolean;
  /** Google-Maps-JS-API freigeben (nur Apps, die eine Karte rendern). Fügt die
   *  minimal nötigen Maps-Hosts zu script-/connect-/img-src hinzu — NICHT pauschal
   *  für alle Apps, damit die CSP sonst eng bleibt (Wurzel 6). */
  googleMaps?: boolean;
}

// Genau die Hosts, die die Google-Maps-JS-API braucht — nicht mehr.
const MAPS_SCRIPT = ["https://maps.googleapis.com"];
const MAPS_CONNECT = ["https://maps.googleapis.com", "https://maps.gstatic.com"];
const MAPS_IMG = ["https://maps.googleapis.com", "https://maps.gstatic.com", "https://*.googleusercontent.com"];

/** Baut den CSP-Header-Wert für eine App. */
export function buildCsp(opts: CspOptions = {}): string {
  const { connectHosts = [], frameAncestors = "'none'", dev = false, googleMaps = false } = opts;
  const scriptExtra = googleMaps ? " " + MAPS_SCRIPT.join(" ") : "";
  // `wss:` MUSS mit: ein WebSocket-Ziel wird gegen sein EIGENES Schema geprüft,
  // `https:` deckt es NICHT ab. Ohne diesen Eintrag blockt die CSP jede
  // Realtime-Verbindung (supabase `wss://…/realtime/v1/websocket`) — die UI sieht
  // live aus und aktualisiert nie. Im Dev zusätzlich `ws:` (localhost-HMR/
  // Realtime ohne TLS); in Prod bleibt es bei verschlüsselt.
  const connect = [
    "'self'",
    "https:",
    "wss:",
    ...(dev ? ["ws:"] : []),
    ...connectHosts,
    ...(googleMaps ? MAPS_CONNECT : []),
  ].join(" ");
  const img = ["'self'", "data:", "blob:", "https:", ...(googleMaps ? MAPS_IMG : [])].join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${scriptExtra}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** Header-Liste für next.config `headers()` (source "/:path*").
 *
 * Setzt NEBEN CSP/X-Frame-Options auch die generischen Header (nosniff,
 * Referrer-Policy, Permissions-Policy, HSTS). Damit liefert jede App ihre
 * vollständige Header-Basis selbst — unabhängig davon, ob die Traefik-globale
 * Middleware aktiv ist. Doppelt gesetzte, WERTGLEICHE Header sind unkritisch
 * (Browser nimmt einen); kritisch wären nur widersprüchliche CSP/X-Frame —
 * die kommen ausschließlich von hier. HSTS ist idempotent (max-age gewinnt der
 * höchste), daher unbedenklich auch wenn Traefik es zusätzlich setzt. */
export function securityHeaders(opts: CspOptions = {}) {
  const frameAncestors = opts.frameAncestors ?? "'none'";
  return [
    { key: "Content-Security-Policy", value: buildCsp(opts) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    // HSTS: 1 Jahr + Subdomains. In Prod aktiv; im Dev-Modus weggelassen
    // (localhost soll nicht auf HTTPS-only gepinnt werden). Kein preload
    // (irreversibel per Cache) — das ist eine bewusste Betriebsentscheidung.
    ...(opts.dev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]),
    // X-Frame-Options als Legacy-Fallback zu frame-ancestors. Nur DENY/SAMEORIGIN
    // sind gültig — bei abweichendem frame-ancestors (z. B. Allowlist) weglassen
    // und allein auf die CSP setzen.
    ...(frameAncestors === "'none'"
      ? [{ key: "X-Frame-Options", value: "DENY" }]
      : frameAncestors === "'self'"
        ? [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]
        : []),
  ];
}
