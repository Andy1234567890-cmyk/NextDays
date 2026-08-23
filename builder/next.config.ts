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
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN ?? "";

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
    const gemeinsam = { dev: IST_DEV, googleFonts: true } as const;
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
          frameAncestors: DASHBOARD_ORIGIN
            ? `'self' ${DASHBOARD_ORIGIN}`
            : "'none'",
        }),
      },
    ];
  },
};

export default nextConfig;
