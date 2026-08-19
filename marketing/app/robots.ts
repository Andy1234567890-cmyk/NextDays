// robots.txt — was Suchmaschinen crawlen dürfen, plus Verweis auf die Sitemap.
//
// Gesperrt sind genau die Pfade, die auch nicht in der Sitemap stehen (siehe
// dort für die Begründung je Pfad): die Suchergebnisseite und die Ziele von
// Einmal-Links aus E-Mails. `/api/` gehört ebenfalls dazu — die Route-Handler
// dieser App (Statusabfrage, Newsletter) liefern JSON, das in einem Suchindex
// nichts zu suchen hat.
//
// Absichtlich KEIN pauschales `Disallow: /` mit Ausnahmen: Diese Seite soll
// gefunden werden. Eine Sperre „bis zum Start" wäre hier falsch, weil die
// Marketing-Seite und das Hilfe-Center schon vor dem Start öffentlich sind —
// das ist ihr Zweck.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/hilfe/suche",
          "/newsletter/bestaetigen",
          "/newsletter/abmelden",
          "/konto-loeschen/bestaetigen",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/").replace(/\/$/, ""),
  };
}
