// robots.txt einer Kunden-Website (0430).
//
// Route-Handler statt `app/robots.ts` — dieselbe Begründung wie bei
// sitemap.xml: ein Deployment bedient viele Kunden-Domains, der Inhalt hängt am
// Host.
//
// Die wichtigste Zeile ist der Sitemap-Verweis. Ohne ihn muss ein Crawler die
// Sitemap raten (er versucht /sitemap.xml, aber nicht zuverlässig), und die
// Objektseiten, die nur über ein Suchformular erreichbar sind, findet niemand.
import { aktuellerHost } from "@/lib/host";
import { basisUrl, ladeSitemap } from "@/lib/seo";

export async function GET(): Promise<Response> {
  const host = await aktuellerHost();
  // Kein Host = keine zuordenbare Website. Fail-closed: `Disallow: /`.
  //
  // „Ich weiß nicht, wessen Seite das ist, also darf alles gecrawlt werden"
  // wäre die falsche Richtung — eine noch nicht eingerichtete oder gerade
  // umziehende Domain käme so in den Index und müsste mühsam wieder heraus.
  if (!host) return antwort("User-agent: *\nDisallow: /\n");

  const daten = await ladeSitemap(host);
  if (!daten) return antwort("User-agent: *\nDisallow: /\n");

  if (daten.noindex) {
    // Der Hauptschalter „nicht indexieren". `Disallow: /` allein reicht nicht,
    // weil es das CRAWLEN verbietet, nicht das Anzeigen: eine Adresse, auf die
    // von außen verlinkt wird, kann trotzdem im Index landen — dann ohne
    // Beschreibung, weil Google die Seite nicht lesen durfte. Deshalb setzt
    // jede Seite zusätzlich `<meta name="robots" content="noindex">`
    // (siehe app/[slug]/page.tsx).
    return antwort("User-agent: *\nDisallow: /\n");
  }

  const zeilen = [
    "User-agent: *",
    "Allow: /",
    // Die Zahlungsstrecke gehört nicht in den Index: sie ist ohne Buchungs-
    // Kontext leer, und eine indexierte Checkout-Adresse ist für einen Gast,
    // der sie aus der Suche aufruft, eine Fehlerseite.
    "Disallow: /checkout/",
    // Der Entwurfs-Renderer des Editors. Er ist Token-geschützt, aber ein
    // Crawler soll ihn gar nicht erst versuchen.
    "Disallow: /render/",
    "Disallow: /widget/",
    "",
    `Sitemap: ${basisUrl(host)}/sitemap.xml`,
    "",
  ];
  return antwort(zeilen.join("\n"));
}

function antwort(text: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
