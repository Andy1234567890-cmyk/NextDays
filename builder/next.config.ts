import type { NextConfig } from "next";
import { securityHeaders } from "@nextdays/security-headers";

// Eigenständige Builder-App (Kunden-Sites) — entkoppelt von apps/web und vom
// globalen Marktplatz plattform/ (eigenes Deployment).
//
// Die Security-Header kommen aus dem geteilten Paket, NICHT aus einer eigenen
// Kopie. Die eigene Kopie hatte kein `dev`-Handling und ließ deshalb im
// Entwicklungsmodus `'unsafe-eval'` aus — das braucht Next für React Refresh.
// Folge: der komplette Client-Code brach beim Start ab („Evaluating a string as
// JavaScript violates the following Content Security Policy directive"), kein
// useEffect lief, und die Text-Bearbeitung in der Vorschau funktionierte nicht.
// Der Fehler war nur in der Browser-Konsole sichtbar.

/**
 * Origin des Dashboards, das die Entwurfs-Vorschau einbetten darf.
 *
 * NUR dieser eine Origin, und NUR für `/render/*` (die token-geschützte
 * Entwurfsansicht). Die echten Kunden-Seiten bleiben framing-frei: dort läuft die
 * Buchungsstrecke, und ein einbettbares Zahlungsformular ist eine Clickjacking-
 * Einladung.
 *
 * Ist die Variable nicht gesetzt, bleibt auch `/render/*` gesperrt — fail-closed
 * (Wurzel 5). Ein Standardwert wie „localhost:3000" wäre in Produktion eine
 * offene Tür, und niemand würde es merken, weil die Vorschau lokal ja ginge.
 */
/** Erlaubte Dashboard-Origins, komma-getrennt.
 *
 *  MEHRERE, weil es real mehrere gibt: das Dashboard lauscht lokal je nach
 *  belegtem Port auf 3000 ODER 3001, und neben der Produktion steht Staging.
 *  Vorher nahm die Variable genau EINEN Wert — passte er nicht, blockte der
 *  Browser den iframe und zeigte „localhost hat die Verbindung abgelehnt".
 *  Diese Meldung liest sich wie ein toter Server und schickt jeden in die
 *  falsche Richtung; in Wahrheit lief alles, nur `frame-ancestors` nannte
 *  einen anderen Port (gemessen am 24.08.2026: Dashboard auf 3001,
 *  DASHBOARD_ORIGIN auf 3000).
 *
 *  Leere Teile fliegen raus, damit ein Komma am Ende nicht zu einem
 *  wertlosen Eintrag in der Richtlinie wird. */
const DASHBOARD_ORIGINS = (process.env.DASHBOARD_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const IST_DEV = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // Geteiltes Workspace-Paket liefert TS-Quellen → mit-transpilieren (ADR-0016).
  transpilePackages: ["@nextdays/currency", "@nextdays/security-headers"],

  async headers() {
    // Google-Fonts: die Kunden-Sites laden die im Baukasten gewählten Schriften
    // von dort. Ohne diese Freigabe steht die Seite in der Fallback-Schrift.
    // `googleTag`: der Betrieb kann im Baukasten seine Google-Kennung eintragen
    // (0430). Ohne diese Freigabe blockt `script-src 'self'` gtag.js still — die
    // Einstellung wäre eine Attrappe, und der Grund stünde nur in der
    // Browser-Konsole.
    // `frameSrc`: der Karten-Abschnitt (0432) bettet Googles Maps-Embed-API als
    // iframe ein. Ohne diese Freigabe greift `default-src 'self'` und der
    // Rahmen bleibt LEER — ohne Fehlermeldung, nur mit einer CSP-Zeile in der
    // Browser-Konsole. Genau daran ist im Dashboard schon eine
    // OpenStreetMap-Karte gescheitert (web/components/reservierungen/
    // property-location.tsx), deshalb steht es hier von Anfang an.
    //
    // Die Embed-API und NICHT die JS-API (`@vis.gl/react-google-maps`, wie im
    // Dashboard): sie versteht eine ADRESSE direkt. Die JS-API braucht
    // Koordinaten, also einen Geocoding-Aufruf pro Seitenansicht — für eine
    // Karte, die nur einen Ort zeigt, wäre das ein zweiter kostenpflichtiger
    // Dienst und ein zusätzliches JS-Bundle auf jeder Gästeseite.
    const gemeinsam = {
      dev: IST_DEV,
      googleFonts: true,
      googleTag: true,
      // Nicht in das `as const` gezogen: `CspOptions.frameSrc` erwartet ein
      // veränderliches `string[]`, und ein `readonly`-Tupel passt darauf nicht.
      frameSrc: ["https://www.google.com"] as string[],
    } as const;
    return [
      {
        // Alles AUSSER /render und /widget: kein Framing.
        //
        // Negatives Matching, damit die Framing-Regeln unten nicht gegen ein
        // bereits gesetztes `X-Frame-Options: DENY` ankämpfen müssen — dieser
        // Kopf kennt keine Allowlist, ein einmal gesetztes DENY blockiert den
        // iframe unabhängig von der CSP.
        source: "/:path((?!(?:render|widget)(?:/|$)).*)",
        headers: securityHeaders({ ...gemeinsam, frameAncestors: "'none'" }),
      },
      {
        // Einbettbares Widget für FREMDE Seiten: von überall framebar.
        //
        // Das ist eine bewusste Ausnahme, und sie hängt an einer Eigenschaft der
        // Route: `/widget/*` führt KEINE Aktion mit Nebenwirkung aus. Sie hält
        // ein Formular, das aus dem Rahmen heraus auf die Kunden-Website
        // navigiert — kein Zahlungsschritt, kein Anmeldefeld, keine Sitzung.
        // Ein Klick, den ein fremder Seitenbetreiber herbeitrickst, löst deshalb
        // nichts aus außer einem Seitenwechsel.
        //
        // Sobald diese Route je etwas anderes täte als navigieren, muss diese
        // Zeile weg. Der Zweck der Einbettung ist genau der: der Betrieb hat
        // eine bestehende Seite bei einem Dritten und will von dort in seine
        // Buchungsstrecke verweisen — eine Allowlist wäre dafür sinnlos, weil
        // wir seine fremde Domain nicht kennen.
        source: "/widget/:path*",
        headers: securityHeaders({ ...gemeinsam, frameAncestors: "*" }),
      },
      {
        // Entwurfs-Vorschau für den Baukasten-Editor. Der Zugriff hängt am
        // HMAC-Token (Backend, 1 h Gültigkeit); das Framing zusätzlich am
        // Dashboard-Origin. Ohne gesetzten Origin bleibt es bei 'none'.
        source: "/render/:path*",
        headers: securityHeaders({
          ...gemeinsam,
          frameAncestors: DASHBOARD_ORIGINS.length
            ? `'self' ${DASHBOARD_ORIGINS.join(" ")}`
            : "'none'",
        }),
      },
    ];
  },
};

export default nextConfig;
