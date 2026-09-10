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
  /** Fremde Origins, die diese App per <iframe> EINBETTEN darf (frame-src).
   *  Mit Schema, z. B. "https://sites.mynextdays.dk".
   *
   *  Ohne diese Option gibt es keine frame-src-Direktive und der Browser fällt
   *  auf `default-src 'self'` zurück — jeder fremde iframe wird dann still
   *  blockiert. Genau daran ist schon eine OpenStreetMap-Karte gescheitert
   *  (siehe web/components/reservierungen/property-location.tsx) und danach die
   *  Live-Vorschau des Website-Baukastens: der iframe blieb leer, ohne dass im
   *  Code ein Fehler war. Wer einen fremden iframe einbettet, MUSS seinen Origin
   *  hier eintragen. */
  frameSrc?: string[];
  /** Eigene `blob:`-Objekte im iframe anzeigen duerfen (frame-src blob:).
   *
   *  Gebraucht fuer Dateien, die AUTHENTIFIZIERT geholt werden muessen: ein
   *  PDF aus einem privaten Bucket laesst sich nicht als Adresse ins iframe
   *  geben, weil das Sitzungs-Cookie `sameSite: lax` bei einer
   *  Sub-Ressourcen-Anfrage nicht mitgeht. Der richtige Weg ist `fetch`
   *  (Cookie geht mit, gleiche Herkunft) und Anzeige als `blob:` — nur
   *  blockiert der `default-src 'self'`-Fallback genau das, und Chrome
   *  meldet lapidar „Dieser Inhalt ist blockiert" (live am 10.09.2026 bei
   *  der Hausmappen-Vorschau).
   *
   *  Eng: `blob:` bezeichnet AUSSCHLIESSLICH Objekte, die diese Seite selbst
   *  im Speicher angelegt hat. Es oeffnet keine fremde Herkunft, ist nicht
   *  adressierbar und stirbt mit dem Tab. Die Alternative — das Cookie auf
   *  `sameSite: none` zu stellen — waere die echte Schwaechung gewesen. */
  frameBlob?: boolean;
  /** Dev-Modus braucht 'unsafe-eval' (React-Debugging). In Prod NIE. */
  dev?: boolean;
  /** Google-Maps-JS-API freigeben (nur Apps, die eine Karte rendern). Fügt die
   *  minimal nötigen Maps-Hosts zu script-/connect-/img-src hinzu — NICHT pauschal
   *  für alle Apps, damit die CSP sonst eng bleibt (Wurzel 6). */
  googleMaps?: boolean;
  /** Google-Fonts freigeben (nur Apps, die Schriften von dort laden).
   *
   *  Zwei Hosts, beide nötig: das Stylesheet kommt von `fonts.googleapis.com`,
   *  die Schriftdateien von `fonts.gstatic.com`. Fehlt einer, lädt die Schrift
   *  nicht und die Seite steht in der Fallback-Schrift — ohne sichtbaren Fehler
   *  außer einer CSP-Zeile in der Konsole. */
  googleFonts?: boolean;
  /** Google-Tag (gtag.js) freigeben — Analytics, Ads, Campaign Manager.
   *
   *  Nur für Apps, in denen ein Kunde seine eigene Mess-Kennung eintragen kann;
   *  aktuell ist das der Seiten-Renderer (builder/). Ohne diese Option blockt
   *  `script-src 'self'` das Skript still: die Kennung steht im Baukasten, der
   *  Betrieb sieht keine Zahlen, und der Grund steht nur in der Browser-Konsole
   *  — genau die Art Attrappe, die Wurzel 4 verbietet.
   *
   *  `connect-src` und `img-src` brauchen keinen Zusatz: beide führen bereits
   *  `https:`, und die Mess-Aufrufe gehen ausschließlich dorthin. Nur
   *  `script-src` ist eng (kein `https:`), deshalb steht hier ein einzelner
   *  Host statt einer Liste. */
  googleTag?: boolean;
  /** reCAPTCHA Enterprise freigeben (nur Apps, die ein oeffentliches Formular
   *  mit Spamschutz rendern — aktuell der Seiten-Renderer `builder/`).
   *
   *  ZWEI Hosts in `script-src`, beide noetig: das Lade-Skript kommt von
   *  `www.google.com/recaptcha/enterprise.js`, seine Bibliothek von
   *  `www.gstatic.com`. Dazu `frame-src www.google.com` — die unsichtbare
   *  Variante haengt trotzdem einen iframe in die Seite, und ohne diese
   *  Direktive greift der `default-src 'self'`-Rueckfall.
   *
   *  Fehlt die Option, blockt die CSP das Skript STILL: `grecaptcha` ist nie
   *  definiert, das Formular schickt kein Token, und die API weist mit 403 ab.
   *  Der Grund stuende nur in der Browser-Konsole — genau die Art Attrappe, die
   *  Wurzel 4 verbietet. */
  recaptcha?: boolean;
  /** WebAssembly freigeben (`'wasm-unsafe-eval'`, CSP Level 3).
   *
   *  Nur für Apps, die im Browser ein WASM-Modul instanziieren — aktuell der
   *  HEIC-Decoder `heic2any` (libheif, Emscripten) im Gastgeber-Dashboard und
   *  das Layout-Modul yoga von `@react-pdf/renderer` im PMS (Kartei-PDF). Ohne
   *  diesen Eintrag verweigert der Browser `WebAssembly.instantiate` mit
   *  „'unsafe-eval' is not an allowed source" — und zwar NUR in Produktion:
   *  im Dev steht `'unsafe-eval'` ohnehin in der Liste, dort läuft es. Live
   *  passiert am 03.09.2026 beim Klick auf „Als PDF exportieren" in der Kartei:
   *  `Aborted(CompileError: WebAssembly.instantiate() … violates … script-src)`.
   *
   *  `'wasm-unsafe-eval'` erlaubt AUSSCHLIESSLICH WebAssembly, kein `eval()`
   *  und keine `Function()`-Konstruktion — deshalb dieser Schlüssel und nicht
   *  `'unsafe-eval'`. */
  wasm?: boolean;
}

// Genau die Hosts, die die Google-Maps-JS-API braucht — nicht mehr.
const MAPS_SCRIPT = ["https://maps.googleapis.com"];
const MAPS_CONNECT = ["https://maps.googleapis.com", "https://maps.gstatic.com"];
const MAPS_IMG = ["https://maps.googleapis.com", "https://maps.gstatic.com", "https://*.googleusercontent.com"];
// Maps lädt seine Schriften über ein Stylesheet von fonts.googleapis.com, das
// wiederum die Dateien von fonts.gstatic.com holt — beide Direktiven sind in
// Googles CSP-Doku ausdrücklich so genannt.
//
// Sie fehlten, obwohl script-/connect-/img-src längst freigegeben waren: die
// Karte lud, aber jedes Stylesheet lief in „violates the following Content
// Security Policy directive: style-src 'self' 'unsafe-inline'" (live in der
// Browser-Konsole). Die Beschriftungen der Karte standen damit in der
// Fallback-Schrift statt in Googles Roboto.
const MAPS_STYLE = ["https://fonts.googleapis.com"];
const MAPS_FONT = ["https://fonts.gstatic.com"];

// gtag.js kommt ausschließlich von diesem Host — auch für Ads (AW-) und
// Campaign Manager (DC-). `www.google-analytics.com` ist NICHT nötig: das ist
// das Mess-Ziel (connect-src/img-src, dort deckt `https:` es ab), nicht die
// Skript-Quelle.
const TAG_SCRIPT = ["https://www.googletagmanager.com"];

// reCAPTCHA Enterprise. `www.google.com` liefert `enterprise.js`,
// `www.gstatic.com` die Bibliothek dahinter; der Rahmen der Pruefung kommt
// ebenfalls von `www.google.com`.
const RECAPTCHA_SCRIPT = ["https://www.google.com", "https://www.gstatic.com"];
const RECAPTCHA_FRAME = ["https://www.google.com"];

/** Baut den CSP-Header-Wert für eine App. */
export function buildCsp(opts: CspOptions = {}): string {
  const {
    connectHosts = [],
    frameAncestors = "'none'",
    frameSrc = [],
    dev = false,
    googleMaps = false,
    googleFonts = false,
    googleTag = false,
    recaptcha = false,
    wasm = false,
  } = opts;
  const scriptHosts = [
    ...(googleMaps ? MAPS_SCRIPT : []),
    ...(googleTag ? TAG_SCRIPT : []),
    ...(recaptcha ? RECAPTCHA_SCRIPT : []),
  ];
  const scriptExtra =
    (wasm ? " 'wasm-unsafe-eval'" : "") + (scriptHosts.length > 0 ? " " + scriptHosts.join(" ") : "");
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
  // Maps und Fonts brauchen dieselben zwei Hosts — Set verhindert Dubletten.
  const styleHosts = new Set<string>();
  const fontHosts = new Set<string>();
  if (googleMaps || googleFonts) {
    for (const h of MAPS_STYLE) styleHosts.add(h);
    for (const h of MAPS_FONT) fontHosts.add(h);
  }
  const style = ["'self'", "'unsafe-inline'", ...styleHosts].join(" ");
  const font = ["'self'", "data:", ...fontHosts].join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${scriptExtra}`,
    `style-src ${style}`,
    `img-src ${img}`,
    `font-src ${font}`,
    `connect-src ${connect}`,
    `frame-ancestors ${frameAncestors}`,
    // Nur setzen, wenn die App wirklich fremde iframes einbettet. Ohne die
    // Direktive gilt weiterhin der `default-src 'self'`-Fallback — das ist der
    // engere Zustand und soll der Standard bleiben.
    // `Set` gegen Dubletten: `builder` traegt `https://www.google.com` schon
    // fuer die Maps-Einbettung ein, und reCAPTCHA braucht denselben Host.
    ...(frameSrc.length > 0 || recaptcha || opts.frameBlob
      ? [
          `frame-src ${[
            "'self'",
            ...(opts.frameBlob ? ["blob:"] : []),
            ...new Set([...frameSrc, ...(recaptcha ? RECAPTCHA_FRAME : [])]),
          ].join(" ")}`,
        ]
      : []),
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
