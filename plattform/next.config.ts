import type { NextConfig } from "next";
import { securityHeaders } from "@nextdays/security-headers";

// Eigenständige Plattform-App — bewusst entkoppelt von apps/web (eigenes
// Deployment, kein Backend-Coupling, vgl. ADR-0002 für marketing/).
const nextConfig: NextConfig = {
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // Geteilte Workspace-Packages (@nextdays/*) liefern TS-Quellen → Next muss sie
  // mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: [
    "@nextdays/currency",
    "@nextdays/laender",
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
