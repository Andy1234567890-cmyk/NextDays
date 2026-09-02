import type { MetadataRoute } from "next";

// Eingeloggter Bereich — nichts hier gehört in einen Suchindex.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
