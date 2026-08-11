// sitemap.xml der Plattform (Next generiert daraus /sitemap.xml). Enthält die
// statischen öffentlichen Seiten UND die Detailseiten der aktiven, suchmaschinen-
// indexierbaren Objekte. noindex-Objekte (Host-Schalter aus) liefert das Backend
// gar nicht erst — sie tauchen hier also nie auf.
import type { MetadataRoute } from "next";

import { envUrl } from "@/lib/backend-basis";
import { ladeSitemapInserate } from "@/lib/inserate";

// envUrl statt `?? …`: ein leeres Build-Arg ergäbe URLs ohne Host.
const SITE_URL = envUrl(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3100");

// Öffentliche statische Seiten (immer indexierbar).
const STATISCH = ["", "/agb"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const inserate = await ladeSitemapInserate();

  const statisch: MetadataRoute.Sitemap = STATISCH.map((pfad) => ({
    url: `${SITE_URL}${pfad}`,
    changeFrequency: "daily",
    priority: pfad === "" ? 1 : 0.5,
  }));

  const objekte: MetadataRoute.Sitemap = inserate.map((i) => ({
    url: `${SITE_URL}/inserat/${i.id}`,
    // Nur setzen, wenn das Backend einen echten Zeitstempel lieferte (kein Fake).
    ...(i.updatedAt ? { lastModified: new Date(i.updatedAt) } : {}),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...statisch, ...objekte];
}
