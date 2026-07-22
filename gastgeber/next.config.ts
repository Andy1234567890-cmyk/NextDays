import type { NextConfig } from "next";
import { securityHeaders } from "@nextdays/security-headers";

// Gastgeber-Dashboard — eigenständiges Projekt auf eigener Subdomain (host.),
// getrennt von der Gast-App plattform/ (ADR-0015). Eingeloggter Bereich → nie
// indexieren (kein SEO nötig, Isolierung zählt).
const nextConfig: NextConfig = {
  output: "standalone",
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // Geteilte Workspace-Packages (@nextdays/*) liefern TS-Quellen → Next muss sie
  // mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: [
    "@nextdays/laender",
    "@nextdays/currency",
    "@nextdays/security-headers",
  ],
  // CSP + X-Frame-Options (pro App). HSTS/nosniff/Referrer setzt Traefik global.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev: process.env.NODE_ENV !== "production" }),
      },
    ];
  },
};

export default nextConfig;
