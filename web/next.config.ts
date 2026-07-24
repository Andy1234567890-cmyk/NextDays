import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "@nextdays/security-headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlanker, eigenständiger Server-Output für den Docker-Runtime-Stage
  // (kopiert nur die wirklich benötigten Dateien + node_modules-Teilmenge).
  output: "standalone",
  // Monorepo hat mehrere Lockfiles → Repo-Root deterministisch als
  // File-Tracing-Root (relativ: lokal + Docker-Root-Kontext).
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // Geteiltes Workspace-Package (@nextdays/currency) liefert TS-Quellen → Next
  // muss es mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: ["@nextdays/ui", "@nextdays/currency", "@nextdays/auth",
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
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          googleMaps: true,
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
