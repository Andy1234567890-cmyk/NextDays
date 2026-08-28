// RSS-Feed des Blogs (0438).
//
// Warum überhaupt: ein Feed ist der Weg, auf dem Stammgäste und lokale
// Portale einem Blog folgen, ohne ihn zu besuchen. Er kostet nichts — die
// Daten liegen ohnehin vor — und er ist die einzige Ausgabeform, die auch
// dann noch funktioniert, wenn jemand keinen Newsletter will.
//
// Route-Handler und nicht die Next-Konvention: dieselbe Begründung wie bei
// sitemap.xml — ein Deployment bedient viele Kunden-Domains, der Inhalt hängt
// am Host.
import { aktuellerHost } from "@/lib/host";
import { basisUrl, ladeBeitraege, ladeSitemap } from "@/lib/seo";

/** XML-Sonderzeichen maskieren.
 *
 *  Nötig, weil ein Beitragstitel ein `&` enthalten kann und der Feed damit
 *  KOMPLETT unlesbar wird — ein Leser meldet dann „ungültiger Feed" für alle
 *  Beiträge, nicht für den einen. */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(): Promise<Response> {
  const host = await aktuellerHost();
  if (!host) return new Response("Not found", { status: 404 });

  // Der Name der Website und der noindex-Zustand kommen aus derselben Quelle
  // wie für die Sitemap — ein Feed einer Website, die nicht gefunden werden
  // will, gibt es nicht.
  const daten = await ladeSitemap(host);
  if (!daten || daten.noindex) return new Response("Not found", { status: 404 });

  const beitraege = await ladeBeitraege(host, { limit: 30 });
  if (beitraege.items.length === 0) {
    // Kein Beitrag = kein Feed. Ein leerer, gültiger Feed sagt einem Leser
    // „dieser Blog hat nichts" und er fragt seltener nach.
    return new Response("Not found", { status: 404 });
  }

  const basis = basisUrl(host);
  // Drei Ränge, absteigend spezifisch (0457): der eigene RSS-Titel, sonst der
  // Blogname, sonst der Name der Website — und ganz zuletzt der Host, damit ein
  // Feed nie ohne Titel ausgeht. Kein erfundener Wert dazwischen (Wurzel 4).
  const blog = beitraege.blog;
  const name =
    blog.rss_title?.trim() ||
    blog.blog_name?.trim() ||
    daten.site_name?.trim() ||
    host;
  const beschreibung =
    blog.rss_description?.trim() || daten.seo_description?.trim() || name;
  const eintraege = beitraege.items.map((b) => {
    const url = `${basis}/blog/${b.slug}`;
    return [
      "    <item>",
      `      <title>${xml(b.title)}</title>`,
      `      <link>${xml(url)}</link>`,
      // `guid` mit `isPermaLink="true"`: die Adresse IST die Kennung. Ohne
      // guid entscheidet jeder Leser selbst, was ein neuer Beitrag ist — und
      // manche zeigen dann alles doppelt.
      `      <guid isPermaLink="true">${xml(url)}</guid>`,
      b.published_at
        ? `      <pubDate>${new Date(b.published_at).toUTCString()}</pubDate>`
        : null,
      b.author ? `      <dc:creator>${xml(b.author)}</dc:creator>` : null,
      b.excerpt ? `      <description>${xml(b.excerpt)}</description>` : null,
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"' +
      ' xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${xml(name)}</title>`,
    `    <link>${xml(`${basis}/blog`)}</link>`,
    `    <description>${xml(beschreibung)}</description>`,
    // Das Kanalbild. `<image>` verlangt laut RSS-2.0-Spezifikation title und
    // link MIT — ein `<image>` mit nur einer URL ist ungültig, und manche Leser
    // verwerfen dann den ganzen Feed.
    ...(blog.rss_image_url?.trim()
      ? [
          "    <image>",
          `      <url>${xml(blog.rss_image_url.trim())}</url>`,
          `      <title>${xml(name)}</title>`,
          `      <link>${xml(`${basis}/blog`)}</link>`,
          "    </image>",
        ]
      : []),
    daten.default_language
      ? `    <language>${xml(daten.default_language)}</language>`
      : null,
    // `atom:link rel="self"`: der Feed sagt, wo er selbst liegt. Feed-Leser
    // und Validatoren erwarten das; ohne die Zeile meldet der W3C-Validator
    // eine Warnung.
    `    <atom:link href="${xml(`${basis}/blog/rss.xml`)}" rel="self"` +
      ' type="application/rss+xml" />',
    ...eintraege,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
