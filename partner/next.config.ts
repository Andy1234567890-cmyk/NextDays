import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "@nextdays/security-headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Partner-Dashboard des Affiliate-Programms (0517) — eigenständiges Projekt auf
// eigener Subdomain (partner.), dritte Auth-Welt neben Betrieb und Gast
// (ADR-0015/0020). Eingeloggter Bereich → nie indexieren.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
  transpilePackages: [
    "@nextdays/auth",
    "@nextdays/icons",
    "@nextdays/laender",
    "@nextdays/security-headers",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        // recaptcha: die Bewerbung wird serverseitig mit reCAPTCHA Enterprise
        // bewertet; das Skript kommt von google.com.
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          recaptcha: true,
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
