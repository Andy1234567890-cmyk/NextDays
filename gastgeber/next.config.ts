import type { NextConfig } from "next";

// Gastgeber-Dashboard — eigenständiges Projekt auf eigener Subdomain (host.),
// getrennt von der Gast-App plattform/ (ADR-0015). Eingeloggter Bereich → nie
// indexieren (kein SEO nötig, Isolierung zählt).
const nextConfig: NextConfig = {
  output: "standalone",
  // Geteilte Workspace-Packages (@nextdays/*) liefern TS-Quellen → Next muss sie
  // mit-transpilieren (ADR-0016, bun-Workspace).
  transpilePackages: ["@nextdays/laender", "@nextdays/currency"],
};

export default nextConfig;
