import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlanker, eigenständiger Server-Output für den Docker-Runtime-Stage
  // (kopiert nur die wirklich benötigten Dateien + node_modules-Teilmenge).
  output: "standalone",
};

export default withNextIntl(nextConfig);
