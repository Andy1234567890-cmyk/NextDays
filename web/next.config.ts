import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlanker, eigenständiger Server-Output für den Docker-Runtime-Stage
  // (kopiert nur die wirklich benötigten Dateien + node_modules-Teilmenge).
  output: "standalone",
  // Geteiltes Workspace-Package (@nextdays/currency) liefert TS-Quellen → Next
  // muss es mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: ["@nextdays/currency"],
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
};

export default withNextIntl(nextConfig);
