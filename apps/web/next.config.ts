import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Schlanker, eigenständiger Server-Output für den Docker-Runtime-Stage
  // (kopiert nur die wirklich benötigten Dateien + node_modules-Teilmenge).
  output: "standalone",
  // Datei-Uploads (Avatar, Objekt-Bilder, Galerie-Fotos) laufen über Server
  // Actions in lib/*.ts. Next.js begrenzt Server-Action-Bodies sonst auf 1 MB —
  // das Backend erlaubt bis 20 MB, also hier denselben Wert setzen.
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default withNextIntl(nextConfig);
