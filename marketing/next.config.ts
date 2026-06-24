import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlankes Runtime-Image für den Dockerfile-Build (node server.js).
  output: "standalone",
};

export default nextConfig;
