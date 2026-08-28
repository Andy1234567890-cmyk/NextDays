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
import { istSprache, mitSprache } from "@/lib/sprache";

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

  // Die Sprachen, für die überhaupt hreflang ausgegeben wird — dieselbe Regel
  // wie in `metadaten.ts`: nur die eingerichteten, nicht der 24er-Rückfall. Eine
  // Sprachfassung anzukündigen, die es nicht gibt, macht aus allen Adressen
  // Duplikate.
  // `languages` und `default_language` kommen aus der Sitemap-Antwort selbst.
  // Das Backend liefert sie seit 0426 mit dem ausdrücklichen Zweck „der
  // Renderer baut daraus die hreflang-Alternativen" — getan hat er es nie, das
  // Feld war vier Monate tote Deklaration.
  const sprachen = (daten.languages ?? []).filter(istSprache);
  const standard = daten.default_language;

  /** Die `<xhtml:link>`-Zeilen einer Adresse — für JEDE Sprachfassung, plus
   *  `x-default`.
   *
   *  Sie stehen in JEDER `<url>`, auch in der der Sprachfassung selbst: Google
   *  verlangt, dass jede Fassung sich selbst und alle anderen listet, und
   *  ignoriert den ganzen Satz, wenn ein Rückverweis fehlt. */
  const alternativen = (pfad: string): string[] => {
    if (sprachen.length < 2) return [];
    const zeilen = sprachen.map(
      (l) =>
        `    <xhtml:link rel="alternate" hreflang="${xml(l)}" href="${xml(
          basis + mitSprache(pfad, l, standard),
        )}"/>`,
    );
    zeilen.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(
        basis + pfad,
      )}"/>`,
    );
    return zeilen;
  };

  for (const seite of daten.pages) {
    const datum = lastmod(seite.lastmod);
    const pfad = seitenPfad(seite.slug);
    eintraege.push(
      [
        "  <url>",
        `    <loc>${xml(basis + pfad)}</loc>`,
        ...alternativen(pfad),
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
        // Objektseiten sind seit 0476 ebenfalls unter Sprachpräfix
        // erreichbar und rendern dort übersetzt — sie brauchen dieselbe
        // hreflang-Kette wie die Seiten, sonst ist der Satz unvollständig.
        ...alternativen(`/inserat/${objekt.id}`),
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
        ...alternativen(`/blog/${beitrag.slug}`),
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
      [
        "  <url>",
        `    <loc>${xml(`${basis}/blog`)}</loc>`,
        ...alternativen("/blog"),
        "  </url>",
      ].join(
        "\n",
      ),
    );
  }

  const kopf = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    daten.abgeschnitten
      ? "<!-- Diese Sitemap ist bei 5000 Adressen abgeschnitten. -->"
      : null,
    // Der `xhtml`-Namensraum ist Pflicht, sobald `<xhtml:link>` vorkommt —
    // ohne ihn ist die Datei kein gültiges XML und Google verwirft sie
    // vollständig. Er steht auch dann da, wenn die Website nur eine Sprache
    // führt: ein unbenutzter Namensraum kostet nichts, ein fehlender kostet
    // die ganze Sitemap.
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
      ' xmlns:xhtml="http://www.w3.org/1999/xhtml">',
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
