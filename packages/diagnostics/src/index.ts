// Diagnose-Reporter für die Frontends. ZWEI Stufen, streng getrennt:
//
// 1. IMMER (rein technisch, keine Einwilligung nötig):
//    unbehandelte JS-Fehler, abgelehnte Promises, fehlgeschlagene
//    Backend-Aufrufe (4xx/5xx), auffällig langsame Aufrufe.
//
// 2. NUR BEI AKTIVER FREIGABE (setAktivitaetsAufzeichnung(true)):
//    Seitenwechsel und Bedienschritte (Button-/Link-Beschriftung). Damit sieht
//    der Support den kompletten Ablauf, nicht nur den Moment des Fehlers.
//    Das ist einwilligungspflichtig, weil es nachzeichnet, was jemand getan
//    hat — deshalb schaltet es ausschließlich der Kunde frei, zeitlich
//    begrenzt und widerrufbar. Der Server verwirft solche Ereignisse ohne
//    Freigabe zusätzlich (Wurzel 3).
//
// NIE ERFASST — in keiner Stufe: Eingabeinhalte, Formularwerte,
// Bildschirminhalte, Gast- oder Zahlungsdaten. Query-Strings werden vor dem
// Senden abgeschnitten (dort stehen Suchbegriffe und IDs).

export type EventKind =
  | "error"
  | "api_error"
  | "slow_request"
  | "client_info"
  // Nur während einer aktiven Diagnose-Freigabe:
  | "navigation"
  | "aktion"
  // Vollständiger Aufruf: gesendeter Inhalt + Antwort des Servers.
  | "aufruf";

// Felder, deren Inhalt NIE erfasst wird — auch nicht bei aktiver Freigabe.
//
// Diagnosewert null, Schadenspotenzial hoch: Ob ein Login scheitert, steht im
// Statuscode; das Passwort im Klartext hilft niemandem und wäre ein echter
// Verlust für den Kunden. Gleiches gilt für Karten- und Token-Daten.
// Abgeglichen wird auf Teilstring in Kleinschreibung, damit auch
// `newPassword`, `card_number` oder `access_token` erfasst sind.
const GEHEIM = [
  "password",
  "passwort",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cvc",
  "cvv",
  "card_number",
  "cardnumber",
  "iban",
  "pin",
];

/** Ersetzt Werte geheimer Felder rekursiv durch einen Platzhalter. */
function ohneGeheimnisse(wert: unknown, tiefe = 0): unknown {
  // Tiefenlimit gegen zyklische oder absurd verschachtelte Strukturen.
  if (tiefe > 6) return "…";
  if (Array.isArray(wert)) {
    return wert.slice(0, 50).map((v) => ohneGeheimnisse(v, tiefe + 1));
  }
  if (wert && typeof wert === "object") {
    const raus: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
      const schluessel = k.toLowerCase();
      raus[k] = GEHEIM.some((g) => schluessel.includes(g))
        ? "«entfernt»"
        : ohneGeheimnisse(v, tiefe + 1);
    }
    return raus;
  }
  return wert;
}

/** JSON-Text zu einem Objekt machen — misslingt das, bleibt der Rohtext. */
function alsInhalt(text: string | undefined): unknown {
  if (!text) return undefined;
  // Obergrenze schon hier: ein großer Upload soll gar nicht erst geparst
  // werden.
  if (text.length > 16_000) return `«${text.length} Zeichen — nicht erfasst»`;
  try {
    return ohneGeheimnisse(JSON.parse(text));
  } catch {
    return text.slice(0, 2000);
  }
}

export interface DiagnosticEvent {
  app: string;
  kind: EventKind;
  message: string;
  path?: string;
  http_status?: number;
  duration_ms?: number;
  context?: Record<string, unknown>;
}

interface Optionen {
  /** Welche Oberfläche: 'gastgeber' | 'plattform' | 'web'. */
  app: string;
  /** Wohin gemeldet wird (BFF-Route der jeweiligen App). */
  endpoint?: string;
  /** Ab dieser Dauer gilt ein Aufruf als langsam (ms). 0 = aus. */
  slowMs?: number;
  /**
   * Läuft für dieses Konto gerade eine Diagnose-Freigabe?
   *
   * MUSS gesetzt sein, damit die Aufzeichnung einen Seitenaufbau überlebt:
   * `setAktivitaetsAufzeichnung(true)` wirkt nur im Speicher der laufenden
   * Seite und ist nach jedem F5 wieder aus. Ohne diese Abfrage sähe der
   * Support nur die Umgebung und nie den Bedienablauf.
   */
  freigabeAktiv?: () => Promise<boolean>;
}

// Puffer, damit nicht jeder Fehler einen eigenen Request auslöst.
let puffer: DiagnosticEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let opts: Optionen | null = null;
let installiert = false;

// Läuft gerade eine Diagnose-Freigabe? Steuert, ob Aktivitätsdaten
// (Seitenwechsel, Bedienschritte) überhaupt erfasst werden. Der Server
// verwirft sie zusätzlich, falls dieses Flag falsch stünde — die Prüfung
// hier spart nur unnötige Requests.
let aktivitaetErlaubt = false;
let entfernen: (() => void)[] = [];

// Obergrenze: Ein Fehler in einer Schleife darf nicht zum Dauerfeuer werden.
const MAX_PUFFER = 50;
const FLUSH_MS = 5000;

/** Query-String entfernen — dort stehen Suchbegriffe und IDs. */
function pfadOhneQuery(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    return u.pathname.slice(0, 300);
  } catch {
    return url.split("?")[0].slice(0, 300);
  }
}

async function flush(): Promise<void> {
  if (!opts || puffer.length === 0) return;
  const events = puffer;
  puffer = [];
  try {
    await fetch(opts.endpoint ?? "/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {
    // Diagnose darf nie stören: schlägt das Melden fehl, ist es verloren.
    // Bewusst kein Retry — sonst könnte ein Ausfall den Client belasten.
  }
}

/**
 * Puffer beim Verlassen der Seite loswerden.
 *
 * `flush()` reicht hier NICHT: Ein Klick auf einen Link löst sofort eine
 * Navigation aus, und der Browser bricht laufende fetch-Aufrufe dabei ab —
 * ausgerechnet die Klicks, die einen Seitenwechsel auslösen, gingen so
 * verloren. `sendBeacon` übergibt die Daten dem Browser, der sie unabhängig
 * von der Seite zu Ende sendet.
 */
function flushBeacon(): void {
  if (!opts || puffer.length === 0) return;
  const body = JSON.stringify({ events: puffer });
  const ziel = opts.endpoint ?? "/api/diagnose";
  const gesendet =
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function" &&
    navigator.sendBeacon(ziel, new Blob([body], { type: "application/json" }));
  if (gesendet) {
    puffer = [];
    return;
  }
  void flush();
}

function melde(e: DiagnosticEvent): void {
  if (!opts || puffer.length >= MAX_PUFFER) return;
  puffer.push({ ...e, app: opts.app });
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, FLUSH_MS);
  }
}

/** Ein technisches Ereignis von Hand melden. */
export function reportEvent(e: Omit<DiagnosticEvent, "app">): void {
  melde({ ...e, app: opts?.app ?? "unbekannt" });
}

/**
 * Umgebungsdaten melden und sofort senden.
 *
 * Wird beim Erteilen einer Diagnose-Freigabe aufgerufen. Zwei Gründe: der
 * Support braucht Browser und Bildschirmgröße als Ausgangspunkt jeder
 * Fehlersuche — und ohne diesen Eintrag sähe der Kunde nach der Freigabe eine
 * leere Liste und hielte die Funktion für defekt.
 */
export async function reportClientInfo(): Promise<void> {
  if (typeof window === "undefined") return;
  melde({
    app: opts?.app ?? "unbekannt",
    kind: "client_info",
    message: "Umgebung erfasst",
    path: pfadOhneQuery(window.location.href),
    context: {
      ua: navigator.userAgent.slice(0, 200),
      sprache: navigator.language,
      fenster: `${window.innerWidth}x${window.innerHeight}`,
      bildschirm: `${window.screen.width}x${window.screen.height}`,
      // Verbindungsqualität, falls der Browser sie preisgibt — erklärt oft
      // „langsam"-Meldungen.
      verbindung:
        (navigator as { connection?: { effectiveType?: string } }).connection
          ?.effectiveType ?? null,
    },
  });
  // Sofort senden statt zu puffern — der Support wartet darauf.
  await flush();
}

/**
 * Aufzeichnung der Aktivität ein-/ausschalten.
 *
 * Wird beim Erteilen bzw. Widerrufen einer Diagnose-Freigabe aufgerufen. Nur
 * dann werden Seitenwechsel und Bedienschritte erfasst — außerhalb einer
 * Freigabe wäre das Verhaltens-Tracking.
 */
export function setAktivitaetsAufzeichnung(an: boolean): void {
  if (typeof window === "undefined" || aktivitaetErlaubt === an) return;
  aktivitaetErlaubt = an;

  if (!an) {
    entfernen.forEach((f) => f());
    entfernen = [];
    return;
  }

  // Seitenwechsel: History-API überschreiben (Next.js navigiert clientseitig).
  const meldeSeite = () =>
    melde({
      app: opts?.app ?? "unbekannt",
      kind: "navigation",
      message: "Seite geöffnet",
      path: pfadOhneQuery(window.location.href),
    });

  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (...a: Parameters<typeof history.pushState>) => {
    push(...a);
    meldeSeite();
  };
  history.replaceState = (...a: Parameters<typeof history.replaceState>) => {
    replace(...a);
    meldeSeite();
  };
  window.addEventListener("popstate", meldeSeite);
  entfernen.push(() => {
    history.pushState = push;
    history.replaceState = replace;
    window.removeEventListener("popstate", meldeSeite);
  });

  // Bedienschritte: nur Beschriftung von Buttons/Links — NIE Eingabeinhalte.
  const beiKlick = (ev: MouseEvent) => {
    const ziel = (ev.target as HTMLElement | null)?.closest(
      "button, a, [role='button']",
    );
    if (!ziel) return;
    // aria-label bevorzugen (Icon-Buttons haben keinen Text).
    const text = (
      ziel.getAttribute("aria-label") ||
      ziel.textContent ||
      ziel.getAttribute("title") ||
      ""
    )
      .trim()
      .slice(0, 80);
    if (!text) return;
    melde({
      app: opts?.app ?? "unbekannt",
      kind: "aktion",
      message: text,
      path: pfadOhneQuery(window.location.href),
    });
    // Sofort senden: Ein Klick löst oft eine Navigation aus, und der Puffer
    // (5 s) wäre dann längst verworfen. Genau diese Klicks sind die
    // interessanten.
    flushBeacon();
  };
  window.addEventListener("click", beiKlick, true);
  entfernen.push(() => window.removeEventListener("click", beiKlick, true));

  // Die aktuelle Seite gleich mitnehmen, damit der Verlauf nicht mitten drin
  // beginnt.
  meldeSeite();
}

/**
 * Fehler-Reporter installieren. Idempotent — mehrfacher Aufruf hängt keine
 * zweiten Listener an.
 */
export function installDiagnostics(o: Optionen): void {
  if (installiert || typeof window === "undefined") return;
  installiert = true;
  opts = o;

  // 1) Unbehandelte JS-Fehler.
  window.addEventListener("error", (ev) => {
    melde({
      app: o.app,
      kind: "error",
      message: String(ev.message ?? "Unbekannter Fehler").slice(0, 500),
      path: pfadOhneQuery(window.location.href),
      context: {
        // Nur Herkunft des Fehlers, kein Seiteninhalt.
        source: ev.filename ? pfadOhneQuery(ev.filename) : undefined,
        line: ev.lineno,
        ua: navigator.userAgent.slice(0, 200),
      },
    });
  });

  // 2) Abgelehnte Promises (der häufigste Fall bei Datenfehlern).
  window.addEventListener("unhandledrejection", (ev) => {
    const grund = ev.reason;
    melde({
      app: o.app,
      kind: "error",
      message: String(
        grund instanceof Error ? grund.message : grund,
      ).slice(0, 500),
      path: pfadOhneQuery(window.location.href),
      context: { ua: navigator.userAgent.slice(0, 200) },
    });
  });

  // 3) Fehlgeschlagene und langsame Backend-Aufrufe.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const start = performance.now();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    try {
      const res = await originalFetch(input, init);
      const dauer = Math.round(performance.now() - start);

      // Die Melde-Route selbst nie melden (sonst Endlosschleife).
      if (!url.includes(o.endpoint ?? "/api/diagnose")) {
        if (!res.ok) {
          // Die Request-ID verbindet diesen Fehler mit der Backend-Ursache.
          // Sichtbar nur, weil die API sie per expose_headers freigibt.
          const requestId = res.headers.get("X-Request-Id") ?? undefined;

          melde({
            app: o.app,
            kind: "api_error",
            message: `${res.status} ${res.statusText || ""}`.trim().slice(0, 500),
            path: pfadOhneQuery(url),
            http_status: res.status,
            duration_ms: dauer,
            context: requestId ? { request_id: requestId } : {},
          });

          // Bei aktiver Freigabe zusätzlich der vollständige Aufruf: WAS
          // gesendet wurde und WAS der Server antwortete. Ohne das bleibt ein
          // 422 die Aussage „irgendetwas stimmte nicht".
          //
          // res.clone() ist zwingend: Der Body eines Response lässt sich nur
          // EINMAL lesen. Ohne Klon würde die App eine bereits geleerte
          // Antwort bekommen — die Diagnose würde den Fehler verursachen, den
          // sie beobachten soll.
          if (aktivitaetErlaubt) {
            void res
              .clone()
              .text()
              .then((antwortText) => {
                melde({
                  app: o.app,
                  kind: "aufruf",
                  message:
                    `${(init?.method ?? "GET").toUpperCase()} → ${res.status}`.slice(
                      0,
                      500,
                    ),
                  path: pfadOhneQuery(url),
                  http_status: res.status,
                  duration_ms: dauer,
                  context: {
                    request_id: requestId,
                    gesendet: alsInhalt(
                      typeof init?.body === "string" ? init.body : undefined,
                    ),
                    antwort: alsInhalt(antwortText),
                  },
                });
              })
              .catch(() => {
                // Body nicht lesbar (Stream, bereits verbraucht) — dann bleibt
                // es beim api_error oben.
              });
          }
        } else if (o.slowMs && dauer > o.slowMs) {
          melde({
            app: o.app,
            kind: "slow_request",
            message: `Langsamer Aufruf (${dauer} ms)`,
            path: pfadOhneQuery(url),
            duration_ms: dauer,
          });
        }
      }
      return res;
    } catch (exc) {
      melde({
        app: o.app,
        kind: "api_error",
        message: `Netzwerkfehler: ${
          exc instanceof Error ? exc.message : String(exc)
        }`.slice(0, 500),
        path: pfadOhneQuery(url),
      });
      throw exc;
    }
  };

  // Beim Verlassen der Seite den Puffer noch loswerden. Beide Signale, weil
  // 'pagehide' auf mobilen Browsern beim Wegschalten der App nicht zuverlässig
  // feuert — 'visibilitychange' schon.
  window.addEventListener("pagehide", flushBeacon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushBeacon();
  });

  // Läuft bereits eine Freigabe? Dann die Aufzeichnung sofort wieder
  // anschalten. Ohne das startet sie nur im Moment des Freigabe-Klicks und ist
  // nach dem nächsten Seitenaufbau still — der Support sähe dauerhaft nur die
  // Umgebung. Fehler beim Abfragen bedeuten „keine Freigabe" (fail-closed).
  if (o.freigabeAktiv) {
    void o
      .freigabeAktiv()
      .then((aktiv) => {
        if (aktiv) setAktivitaetsAufzeichnung(true);
      })
      .catch(() => {});
  }
}
