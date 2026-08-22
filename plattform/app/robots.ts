// robots.txt der Plattform (Next generiert daraus /robots.txt).
//
// VOR DEM START (`VOR_DEM_START` in lib/vorstart.ts) ist hier alles gesperrt:
// `Disallow: /` und keine sitemap-Zeile. Das ist der wichtigere Teil des
// Vorstart-Tors — das Tor selbst verbirgt die Seiten nur, aus dem Index holt
// sie erst diese Datei. Live am 21.08.2026 standen 20 echte Inserate mit
// `priority 0.8` in der sitemap.xml und waren indexierbar.
//
// NACH DEM START: Öffentliche Marktplatz-Seiten (Startseite, Inserate, AGB)
// dürfen gecrawlt werden; die eingeloggten/transaktionalen Bereiche (Konto,
// Buchungen, Checkout, Nachrichten …) sind ausgeschlossen — dort steht nichts,
// das in den Index gehört.
//
// Die einzelne Inserat-Seite trägt ZUSÄTZLICH einen robots-Meta-Tag: ist der
// Host-Schalter „Objekte in Suchmaschinen aufnehmen" aus, rendert sie noindex
// (siehe app/inserat/[id]/page.tsx). robots.txt steuert das Crawlen grob, der
// Meta-Tag die Indexierung pro Objekt fein.
import type { MetadataRoute } from "next";

import { envUrl } from "@/lib/backend-basis";
import { VOR_DEM_START } from "@/lib/vorstart";

// envUrl statt `?? …`: ein Build-Arg ohne Wert ist "" und würde relative
// sitemap-/host-Angaben erzeugen (siehe lib/backend-basis.ts).
const SITE_URL = envUrl(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3100");

// Eingeloggte/transaktionale Pfade — nie crawlen lassen.
const PRIVAT = [
  "/anmelden",
  "/konto",
  "/buchungen",
  "/nachrichten",
  "/merkzettel",
  "/bewertungen",
  "/checkout",
  "/aufenthalt",
];

export default function robots(): MetadataRoute.Robots {
  // Vor dem Start: alles sperren, keine sitemap anbieten. Bewusst OHNE
  // `sitemap`-Zeile — eine leere Sitemap zu nennen lädt Crawler ein, sie
  // abzuholen und die Adresse im Gedächtnis zu behalten.
  if (VOR_DEM_START) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVAT,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
