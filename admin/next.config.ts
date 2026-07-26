import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "@nextdays/security-headers";

// Plattform-Backoffice — eigenständiges Projekt auf eigener Subdomain, strikt
// getrennt von gastgeber/ (Betriebe) und plattform/ (Gäste). Diese App zeigt
// als EINZIGE mandantenübergreifende Daten; die Isolierung auf eigene Domain +
// eigene Cookies ist Teil des Sicherheitskonzepts (ADR-0015-Muster).
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
    "@nextdays/auth",
    "@nextdays/currency",
    "@nextdays/security-headers",
    "@nextdays/ui",
  ],
  // CSP + X-Frame-Options (pro App). HSTS/nosniff/Referrer setzt Traefik global.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
        }),
      },
      {
        // Das Backoffice darf NIE in Suchmaschinen landen (auch nicht durch
        // eine versehentlich öffentlich erreichbare Route).
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
