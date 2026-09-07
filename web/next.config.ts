import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "@nextdays/security-headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ausgabeverzeichnis überschreibbar (NEXT_DIST_DIR). `next build` löscht und
  // schreibt sein Zielverzeichnis neu — läuft ein Build gegen dasselbe `.next`,
  // in dem der Dev-Server des Nutzers arbeitet, verliert dieser mitten im
  // Betrieb seine Dateien (ENOENT auf routes-manifest.json, jede Seite 500).
  // Ein Prüf-Build vor dem Commit setzt deshalb ein eigenes Verzeichnis; ohne
  // die Variable bleibt es beim Standard `.next` (Docker/CI unverändert).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Schlanker, eigenständiger Server-Output für den Docker-Runtime-Stage
  // (kopiert nur die wirklich benötigten Dateien + node_modules-Teilmenge).
  output: "standalone",
  // Monorepo hat mehrere Lockfiles → Repo-Root deterministisch als
  // File-Tracing-Root (relativ: lokal + Docker-Root-Kontext).
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Der Next.js-Dev-Indikator (das schwarze Logo unten links, das Build-Status
  // und Route-Info zeigt). Er sitzt genau dort, wo auch unser Sitzungs-Panel
  // steht, und verdeckt es teilweise.
  //
  // Abschaltbar statt fest entfernt: der Indikator meldet laufende Kompilierung
  // und Build-Fehler — wer daran entwickelt, will ihn haben. `NEXT_PUBLIC_`
  // wäre hier falsch, der Wert wird nur beim Start des Dev-Servers gelesen und
  // gehört nicht ins Browser-Bundle.
  //
  // NEXT_DEV_INDICATOR=0 → aus. Ohne die Variable bleibt er an (Voreinstellung
  // von Next), damit niemandem ein Werkzeug stillschweigend fehlt.
  ...(process.env.NEXT_DEV_INDICATOR === "0" ? { devIndicators: false as const } : {}),
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // Geteiltes Workspace-Package (@nextdays/currency) liefert TS-Quellen → Next
  // muss es mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: [
    "@nextdays/baukasten-stil", "@nextdays/diagnostics","@nextdays/ui", "@nextdays/currency", "@nextdays/auth",
    "@nextdays/security-headers"],
  // Datei-Uploads (Avatar, Objekt-Bilder, Galerie-Fotos) laufen über Server
  // Actions in lib/*.ts. Next.js begrenzt Server-Action-Bodies sonst auf 1 MB —
  // das Backend erlaubt bis 20 MB, also hier denselben Wert setzen.
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  // Playwright darf nicht ins Bundle der PDF-Route (/api/v1/generate-pdf-single)
  // gezogen werden — es ist ein natives Node-Modul, das zur Laufzeit aus
  // node_modules geladen wird. Sonst bricht der Build / fehlt der Browser-Launcher.
  serverExternalPackages: ["playwright", "playwright-core"],
  // Den Playwright-Treiber in den standalone-Output mitnehmen (der Runtime-Stage
  // kopiert nur .next/standalone). Der Chromium-Browser selbst wird im Dockerfile
  // separat installiert.
  outputFileTracingIncludes: {
    "/api/v1/generate-pdf-single": ["./node_modules/playwright-core/**/*"],
  },
  // CSP + X-Frame-Options (inhaltsabhängig, pro App). HSTS/nosniff/Referrer setzt
  // Traefik global. Single Source: @nextdays/security-headers (Wurzel 4).
  async headers() {
    return [
      {
        source: "/:path*",
        // googleMaps: web rendert die Standort-Karte (Google-Maps-JS-API).
        // wasm: der PDF-Export der Objektkartei (lib/dossier-pdf.tsx,
        // @react-pdf/renderer) bringt das Layout-Modul yoga als WebAssembly
        // mit. Ohne `'wasm-unsafe-eval'` bricht der Klick auf „Als PDF
        // exportieren" in Produktion mit einem CSP-Fehler ab — im Dev nicht,
        // weil dort `'unsafe-eval'` alles abdeckt (live 03.09.2026).
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          googleMaps: true,
          wasm: true,
          // Der Website-Baukasten bettet die Live-Vorschau der Kunden-Site per
          // iframe ein — den ECHTEN Renderer, nicht eine zweite Nachbildung der
          // Abschnitte. Ohne diesen Eintrag greift `default-src 'self'` und der
          // iframe bleibt still leer (kein Fehler im Code, keine Meldung außer
          // einer CSP-Zeile in der Browser-Konsole).
          //
          // Nur der eine Origin, und nur wenn er konfiguriert ist: ohne die
          // Variable bleibt die CSP eng und der Baukasten zeigt statt der
          // Vorschau einen Hinweis (fail-closed, kein geratener Host).
          frameSrc: process.env.NEXT_PUBLIC_BUILDER_URL
            ? [process.env.NEXT_PUBLIC_BUILDER_URL]
            : [],
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
