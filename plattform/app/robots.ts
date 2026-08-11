// robots.txt der Plattform (Next generiert daraus /robots.txt). Öffentliche
// Marktplatz-Seiten (Startseite, Inserate, AGB) dürfen gecrawlt werden; die
// eingeloggten/transaktionalen Bereiche (Konto, Buchungen, Checkout, Nachrichten
// …) sind ausgeschlossen — dort steht nichts, das in den Index gehört.
//
// Die einzelne Inserat-Seite trägt ZUSÄTZLICH einen robots-Meta-Tag: ist der
// Host-Schalter „Objekte in Suchmaschinen aufnehmen" aus, rendert sie noindex
// (siehe app/inserat/[id]/page.tsx). robots.txt steuert das Crawlen grob, der
// Meta-Tag die Indexierung pro Objekt fein.
import type { MetadataRoute } from "next";

import { envUrl } from "@/lib/backend-basis";

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
