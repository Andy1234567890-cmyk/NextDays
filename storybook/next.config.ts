import type { NextConfig } from "next";

// Auth-Proxy vor dem Storybook. Das gebaute Storybook liegt im PRIVATEN Ordner
// protected/sb und wird nur über die geschützte Route /sb ausgeliefert.
const nextConfig: NextConfig = {
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/sb/[[...path]]": ["./protected/**/*"],
  },
  // CSP inline (isolierter Build, keine @nextdays/*-Packages). Storybook läuft in
  // einer Iframe-Sandbox und braucht 'unsafe-eval' (Component-Rendering) → hier
  // bewusst LAXER als die App-CSP. Der Zugang ist ohnehin auth-geschützt (/sb).
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
