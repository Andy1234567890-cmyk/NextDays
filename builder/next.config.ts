import type { NextConfig } from "next";

// Eigenständige Builder-App (white-label Agentur-Sites) — entkoppelt von
// apps/web und vom globalen Marktplatz plattform/ (eigenes Deployment).
const nextConfig: NextConfig = {
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,

  // Security-Header (W-3, Defense-in-Depth). Die Sites zeigen gast-erstelltes
  // Rich-Text; die serverseitige Sanitisierung (nh3, site_config) ist die erste
  // Verteidigung, die CSP der Backstop. Nur Selbst-Herkunft, kein Framing durch
  // Fremdseiten (Clickjacking), Referrer nur same-origin (Draft-Token-Leak).
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js benötigt inline-Styles/Scripts (Hydration, styled-jsx).
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
