import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // CSP + X-Frame-Options inline: marketing baut BEWUSST isoliert (eigener
  // Dockerfile ohne Root-Kontext, ADR-0016) und nutzt daher KEINE @nextdays/*-
  // Packages — die kleine CSP-Kopie ist hier die dokumentierte Ausnahme, kein
  // Wurzel-4-Verstoß. Statische Marketing-Seite ohne Backend/Server Actions.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
