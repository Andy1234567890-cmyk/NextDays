import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

// next-intl ohne URL-Präfix: die Sprache kommt aus dem nd_locale-Cookie
// (i18n/request.ts), damit bestehende Routen wie /impressum unverändert bleiben.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
  // Diese App baut BEWUSST isoliert (eigene bun.lock, die der Dockerfile
  // kopiert). Ohne diese Zeile sucht Next die Workspace-Wurzel selbst, findet
  // die Root-bun.lock des Monorepos und warnt bei jedem `bun run dev`. Die
  // Trace-Wurzel IST hier das App-Verzeichnis — im Container ist /app die
  // Wurzel, lokal marketing/; process.cwd() trifft beides.
  outputFileTracingRoot: process.cwd(),
  // Kein x-powered-by:Next.js — verrät die Technologie (Version-Leak/Recon).
  poweredByHeader: false,
  // CSP + X-Frame-Options inline: marketing baut BEWUSST isoliert (eigener
  // Dockerfile ohne Root-Kontext, ADR-0016) und nutzt daher KEINE @nextdays/*-
  // Packages — die kleine CSP-Kopie ist hier die dokumentierte Ausnahme, kein
  // Wurzel-4-Verstoß. Statische Marketing-Seite ohne Backend/Server Actions.
  async headers() {
    // Der Support-Chat spricht direkt mit der API (siehe lib/config.ts) — ihre
    // Origin muss in connect-src stehen, sonst blockt der Browser den Aufruf.
    const apiOrigin = (() => {
      try {
        return new URL(
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
        ).origin;
      } catch {
        return "";
      }
    })();
    // Dev-only: Next' react-refresh wertet Code per eval aus. Ohne diese
    // Ausnahme scheitert die Hydration im Dev-Server komplett — die Seite sieht
    // fertig aus, aber NICHTS ist klickbar (Feature-Tabs, Formular). In
    // Produktion bleibt die CSP unverändert streng.
    // reCAPTCHA Enterprise (Spamschutz des Kontaktformulars) lädt sein Skript
    // von www.google.com, dessen Unter-Ressourcen von www.gstatic.com, und
    // zeigt die Aufgabe — wenn nötig — in einem iframe von www.google.com. Alle
    // drei Freigaben sind dafür da und für nichts anderes; ohne sie blockt der
    // Browser den Schutz und das Formular nimmt nichts an (die API weist ohne
    // Token fail-closed ab).
    const RECAPTCHA_HOSTS = "https://www.google.com https://www.gstatic.com";
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? `script-src 'self' 'unsafe-inline' ${RECAPTCHA_HOSTS}`
        : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${RECAPTCHA_HOSTS}`;
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' https:${apiOrigin && !apiOrigin.startsWith("https:") ? ` ${apiOrigin}` : ""}`,
      // Nur google.com: das reCAPTCHA-Aufgabenfenster. `frame-ancestors 'none'`
      // bleibt unberührt — WIR dürfen weiterhin von niemandem eingebettet
      // werden, das ist die andere Richtung.
      `frame-src 'self' https://www.google.com`,
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

export default withNextIntl(nextConfig);
