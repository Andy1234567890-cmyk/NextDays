import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "@nextdays/security-headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Gastgeber-Dashboard — eigenständiges Projekt auf eigener Subdomain (host.),
// getrennt von der Gast-App plattform/ (ADR-0015). Eingeloggter Bereich → nie
// indexieren (kein SEO nötig, Isolierung zählt).
const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo hat mehrere Lockfiles → Repo-Root deterministisch als
  // File-Tracing-Root (relativ: lokal + Docker-Root-Kontext).
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // Geteilte Workspace-Packages (@nextdays/*) liefern TS-Quellen → Next muss sie
  // mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: [
    "@nextdays/diagnostics",
    "@nextdays/laender",
    "@nextdays/currency",
    "@nextdays/auth",
    "@nextdays/ui",
    "@nextdays/security-headers",
  ],
  // CSP + X-Frame-Options (pro App). HSTS/nosniff/Referrer setzt Traefik global.
  async headers() {
    return [
      {
        source: "/:path*",
        // googleMaps: der Objekt-Editor rendert die Preisvergleichs-Karte
        // (Google-Maps-JS-API) → deren Hosts in die CSP freigeben.
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          googleMaps: true,
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
