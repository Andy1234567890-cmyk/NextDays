import type { NextConfig } from "next";

// Eigenständige Builder-App (white-label Agentur-Sites) — entkoppelt von
// apps/web und vom globalen Marktplatz plattform/ (eigenes Deployment).
const nextConfig: NextConfig = {
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
};

export default nextConfig;
