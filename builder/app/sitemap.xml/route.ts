// sitemap.xml einer Kunden-Website (0430).
//
// Als Route-Handler und NICHT als Next-Konvention `app/sitemap.ts`: diese App
// bedient beliebig viele Kunden-Domains aus EINEM Deployment. Die Konvention
// erzeugt eine Datei pro Deployment; hier hängt der Inhalt vollständig am Host
// des Requests. Nur ein Handler darf `headers()` lesen.
//
// Warum überhaupt eine Sitemap, wenn Google auch Links folgt: eine neu
// veröffentlichte Objektseite ist von der Startseite oft nur über ein
// Suchformular erreichbar — also für einen Crawler gar nicht. Ohne Sitemap
// findet sie niemand, bis jemand von außen darauf verlinkt.
import { aktuellerHost } from "@/lib/host";
import { basisUrl, ladeSitemap, seitenPfad } from "@/lib/seo";

/** XML-Sonderzeichen in einer Adresse maskieren.
 *
 *  Nötig, weil ein Slug ein `&` enthalten kann und eine unmaskierte Datei damit
 *  KOMPLETT unlesbar wird — Google meldet dann „Sitemap konnte nicht gelesen
 *  werden" für alle Adressen, nicht nur für die eine. */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** `updated_at` → `YYYY-MM-DD`. Ungültige Werte werden WEGGELASSEN, nicht durch
 *  das heutige Datum ersetzt: ein erfundenes `lastmod` sagt Google „diese Seite
 *  hat sich heute geändert" und ist damit eine Falschaussage, die künftige
 *  Änderungen entwertet (Wurzel 4). */
function lastmod(roh: string | null): string | null {
  if (!roh) return null;
  const d = new Date(roh);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET(): Promise<Response> {
  const host = await aktuellerHost();
  if (!host) return new Response("Not found", { status: 404 });

  const daten = await ladeSitemap(host);
  // Unbekannte Domain, offline geschaltete Website oder Backend nicht
  // erreichbar: KEINE leere Sitemap ausliefern. Eine leere, gültige Datei sagt
  // Google „diese Website hat keine Seiten" — und das ist schlimmer als keine
  // Antwort, weil er sie glaubt.
  if (!daten) return new Response("Not found", { status: 404 });
  // Steht die Website auf „nicht indexieren", gibt es keine Sitemap. Sie wäre
  // die genaue Gegenaussage zur robots.txt, die dann `Disallow: /` liefert.
  if (daten.noindex) return new Response("Not found", { status: 404 });

  const basis = basisUrl(host);
  const eintraege: string[] = [];

  for (const seite of daten.pages) {
    const datum = lastmod(seite.lastmod);
    eintraege.push(
      [
        "  <url>",
        `    <loc>${xml(basis + seitenPfad(seite.slug))}</loc>`,
        datum ? `    <lastmod>${datum}</lastmod>` : null,
        // Die Startseite ist die wichtigste Adresse der Website. `priority` ist
        // für Google seit Jahren wirkungslos, für Bing und kleinere Crawler
        // nicht — und es kostet nichts.
        seite.is_home ? "    <priority>1.0</priority>" : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  for (const objekt of daten.properties) {
    const datum = lastmod(objekt.lastmod);
    eintraege.push(
      [
        "  <url>",
        `    <loc>${xml(`${basis}/inserat/${objekt.id}`)}</loc>`,
        datum ? `    <lastmod>${datum}</lastmod>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // Blog-Beiträge (0438). Ohne sie stünde kein einziger in der Sitemap — und
  // ein Blog, den niemand findet, ist die teuerste Art, Texte zu schreiben.
  for (const beitrag of daten.posts ?? []) {
    const datum = lastmod(beitrag.lastmod);
    eintraege.push(
      [
        "  <url>",
        `    <loc>${xml(`${basis}/blog/${beitrag.slug}`)}</loc>`,
        datum ? `    <lastmod>${datum}</lastmod>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  // Die Blog-Übersicht selbst, aber nur wenn es Beiträge gibt: eine leere
  // /blog-Seite in der Sitemap ist eine Adresse ohne Inhalt.
  if ((daten.posts ?? []).length > 0) {
    eintraege.push(
      ["  <url>", `    <loc>${xml(`${basis}/blog`)}</loc>`, "  </url>"].join(
        "\n",
      ),
    );
  }

  const kopf = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    daten.abgeschnitten
      ? "<!-- Diese Sitemap ist bei 5000 Adressen abgeschnitten. -->"
      : null,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(`${kopf}\n${eintraege.join("\n")}\n</urlset>\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Eine Stunde: neue Objekte sollen zeitnah auftauchen, aber ein Crawler
      // darf die Datei nicht bei jedem Besuch neu erzeugen lassen.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
