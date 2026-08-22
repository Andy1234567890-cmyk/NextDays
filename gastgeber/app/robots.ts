// robots.txt des Gastgeber-Dashboards (Next generiert daraus /robots.txt).
//
// Diese Datei fehlte. Ohne sie liefert Next eine Standard-robots.txt, die
// NICHTS verbietet — live am 22.08.2026 antwortete
// `gastgeber.mybestdays.dk/robots.txt` mit 200 und ohne Disallow, während die
// Anmeldeseite den Markennamen im Titel trug („myBestDays — Gastgeber").
//
// Hier gilt `Disallow: /` DAUERHAFT, nicht nur vor dem Start: ein
// Gastgeber-Dashboard hat keine Seite, die in einen Suchindex gehört. Alles
// außer der Anmeldung verlangt Login, und die Anmeldung selbst ist kein
// Inhalt, den jemand über Google finden soll. Deshalb bewusst OHNE
// `VOR_DEM_START`-Verzweigung — hier gibt es nichts freizugeben, was nach dem
// Start indexierbar werden dürfte.
//
// Das Layout trägt zusätzlich `robots: { index: false, follow: false }`
// (app/layout.tsx). robots.txt hält Crawler vom Abholen ab, der Meta-Tag von
// der Indexierung — beides braucht es, weil eine per Link gefundene Seite auch
// ohne Crawl im Index landen kann.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
