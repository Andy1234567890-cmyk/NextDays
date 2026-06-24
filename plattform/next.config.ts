import type { NextConfig } from "next";

// Eigenständige Plattform-App — bewusst entkoppelt von apps/web (eigenes
// Deployment, kein Backend-Coupling, vgl. ADR-0002 für marketing/).
const nextConfig: NextConfig = {
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
};

export default nextConfig;
