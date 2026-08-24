// llms.txt einer Kunden-Website (0430) — die AEO-Datei.
//
// Was das ist: eine kurze, textuelle Übersicht der Website für
// Antwortmaschinen (ChatGPT, Perplexity, Claude, Google AI Overviews). Sie
// lesen keine sitemap.xml — die ist XML für Crawler — sondern suchen eine
// Zusammenfassung in Markdown. Die Konvention (llmstxt.org) verlangt eine H1
// mit dem Namen, ein Blockquote mit der Kurzbeschreibung und danach
// Abschnitte mit Links.
//
// Warum wir das haben und Hostaway nicht: deren Bereich heißt „SEO/AEO",
// enthält aber ausschließlich klassisches SEO (Meta-Titel, Beschreibung,
// Keywords, Schema-Markup). Für die Antwortmaschinen, die inzwischen einen
// wachsenden Teil der Reise-Recherche beantworten, liefern sie nichts.
//
// Kosten und Risiko: praktisch null. Ignoriert eine Maschine die Datei, ist es
// eine unbesuchte Adresse. Es gibt keinen Weg, sich damit zu schaden — anders
// als bei robots.txt, wo eine falsche Zeile die ganze Website aus dem Index
// nimmt.
import { aktuellerHost } from "@/lib/host";
import { basisUrl, ladeSitemap, seitenPfad } from "@/lib/seo";

export async function GET(): Promise<Response> {
  const host = await aktuellerHost();
  if (!host) return new Response("Not found", { status: 404 });

  const daten = await ladeSitemap(host);
  if (!daten) return new Response("Not found", { status: 404 });
  // Wer nicht in den Suchindex will, will auch nicht in eine Antwortmaschine.
  // Die Datei wäre sonst der Weg, über den eine bewusst zugehaltene Website
  // doch zitiert wird.
  if (daten.noindex) return new Response("Not found", { status: 404 });

  const basis = basisUrl(host);
  const name = daten.site_name?.trim();
  // Ohne Namen keine Datei: eine Übersicht, die „# undefined" beginnt, ist
  // schlechter als keine. Und ein erfundener Name wäre eine Falschaussage über
  // den Betrieb (Wurzel 4).
  if (!name) return new Response("Not found", { status: 404 });

  const zeilen: string[] = [`# ${name}`, ""];
  const beschreibung = daten.seo_description?.trim();
  if (beschreibung) {
    zeilen.push(`> ${beschreibung}`, "");
  }

  const seiten = daten.pages.filter((s) => s.title.trim() || s.is_home);
  if (seiten.length > 0) {
    zeilen.push("## Seiten", "");
    for (const seite of seiten) {
      const titel = seite.title.trim() || (seite.is_home ? name : seite.slug);
      zeilen.push(`- [${titel}](${basis}${seitenPfad(seite.slug)})`);
    }
    zeilen.push("");
  }

  if (daten.properties.length > 0) {
    // Nur die Adressen, keine Titel: die Objektnamen stehen nicht in dieser
    // Antwort, und sie nachzuladen wäre ein Request je Objekt. Die Maschine
    // folgt dem Link und liest dort die vollständigen Angaben — samt des
    // LodgingBusiness-Schemas, das die Objektseite ausliefert.
    zeilen.push("## Unterkünfte", "");
    for (const objekt of daten.properties) {
      zeilen.push(`- ${basis}/inserat/${objekt.id}`);
    }
    zeilen.push("");
  }

  const sprachen = daten.languages ?? [];
  if (sprachen.length > 1) {
    // Welche Sprachen es gibt und wie man sie anfordert. Ohne diese Zeile
    // zitiert eine Antwortmaschine die Standardsprache, auch wenn der Gast in
    // einer anderen fragt.
    zeilen.push(
      "## Sprachen",
      "",
      `Diese Website ist verfügbar in: ${sprachen.join(", ")}.`,
      "Eine Sprache anfordern: `?lang=<code>` an die Adresse anhängen.",
      "",
    );
  }

  zeilen.push(
    "## Hinweise",
    "",
    `- Vollständige Adressliste: ${basis}/sitemap.xml`,
    "- Preise und Verfügbarkeit sind tagesaktuell; die verbindliche Angabe",
    "  steht immer auf der Objektseite.",
    "",
  );

  return new Response(zeilen.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
