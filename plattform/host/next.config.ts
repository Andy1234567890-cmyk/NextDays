import type { NextConfig } from "next";

// Gastgeber-Dashboard — eigenständige App auf eigener Subdomain (host.), getrennt
// von der Gast-App plattform/ (ADR-0015). Eigenes Cookie (__Host-nd_host),
// eigenes Deployment. Eingeloggter Bereich → noindex (kein SEO nötig).
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
