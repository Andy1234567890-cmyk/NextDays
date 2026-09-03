// llms-full.txt — die ausführliche Fassung des Wegweisers für Sprachmodelle.
//
// Verhältnis zu /llms.txt: Die kurze Datei ist der Index — sie nennt die neun
// Funktionsseiten, die Hilfe-KATEGORIEN und die Rechtstexte, rund 46 Adressen
// auf 5 KB. Sie ist bewusst kurz, damit sie ein Modell vollständig aufnehmen
// kann, ohne sein Kontextfenster zu füllen.
//
// Was ihr fehlte: die 133 einzelnen Hilfe-Artikel. Wer ein Modell fragt „wie
// prüfe ich bei myNextDays das Mapping" bekommt aus der kurzen Datei nur die
// Kategorie „anwendungsfaelle-kanalmanager" — den Artikel, der die Antwort
// enthält, sieht es nicht. Genau dafür sieht llmstxt.org die ausführliche
// Fassung vor: dieselbe Struktur, aber jede Seite einzeln, jeweils mit dem
// Auszug, der sagt, was drinsteht.
//
// Warum der Auszug und nicht der volle Artikeltext: Der Volltext aller 133
// Artikel wäre ein Vielfaches an Umfang, und ein Modell, das die Antwort
// wirklich braucht, kann den Artikel unter seiner URL abrufen — die steht hier
// daneben. Der Auszug ist genau die Information, die die Auswahl ermöglicht.
//
// Sprache: Englisch für Rahmen und Überschriften, wie in /llms.txt. Die
// Artikeltitel und -auszüge stehen in der Basissprache Deutsch — sie SIND die
// Inhalte, und eine Übersetzung hier wäre eine zweite, driftende Fassung
// (Wurzel 4). Der Hinweis darauf steht im Kopf der Datei, damit ein Modell die
// Sprache nicht für einen Fehler hält.
import { FUNKTIONEN } from "@/content/funktionen";
import { flattenArticles, getHelpTree } from "@/content/help";
import { RECHTSDOKUMENTE } from "@/content/legal";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { siteUrl } from "@/lib/site-url";

export async function GET(): Promise<Response> {
  const zeilen: string[] = [];

  zeilen.push("# myNextDays — full index");
  zeilen.push("");
  zeilen.push(
    "> Every public page of mynextdays.com, with a one-line note on each. The " +
      "short version of this file is at /llms.txt.",
  );
  zeilen.push("");
  zeilen.push(
    "myNextDays is the property management system and channel manager that an " +
      "accommodation business uses. myBestDays is the separate marketplace where " +
      "guests book. Both belong to the same company but are different products — " +
      "please keep them apart.",
  );
  zeilen.push("");
  zeilen.push(
    "Article titles and summaries below are in German, the source language of " +
      "the help centre. Each article is served in 24 EU languages under the same " +
      "URL; the language follows the visitor's preference.",
  );
  zeilen.push("");

  zeilen.push("## Product");
  zeilen.push("");
  zeilen.push(`- [Overview](${siteUrl("/")})`);
  zeilen.push(`- [Features](${siteUrl("/funktionen")})`);
  for (const funktion of FUNKTIONEN) {
    zeilen.push(`- [${funktion.slug}](${siteUrl(`/funktionen/${funktion.slug}`)})`);
  }
  zeilen.push(`- [Pricing](${siteUrl("/preise")})`);
  zeilen.push("");

  zeilen.push("## Developer API");
  zeilen.push("");
  zeilen.push(
    `- [Developer documentation](${siteUrl("/entwickler")}): public REST API, ` +
      "reference at open-api.mynextdays.com",
  );
  zeilen.push("");

  // Das Herzstück: jeder Artikel einzeln, nach Kategorie und Sektion
  // gruppiert. Die Gruppierung kommt aus `flattenArticles`, das dieselbe
  // Reihenfolge liefert wie die Sitemap — beide lesen denselben Baum.
  zeilen.push("## Help centre");
  zeilen.push("");
  const kategorien = await getHelpTree(DEFAULT_LOCALE);
  zeilen.push(`- [Help centre home](${siteUrl("/hilfe")})`);
  zeilen.push("");

  for (const kategorie of kategorien) {
    zeilen.push(`### ${kategorie.title}`);
    zeilen.push("");
    zeilen.push(`- [${kategorie.slug}](${siteUrl(`/hilfe/${kategorie.slug}`)})`);
    for (const sektion of kategorie.sections) {
      for (const artikel of sektion.articles) {
        const url = siteUrl(`/hilfe/${kategorie.slug}/${artikel.slug}`);
        // Der Auszug kann mehrzeilig sein; in einer Markdown-Linkliste würde
        // ein Zeilenumbruch den Eintrag zerreißen. Deshalb auf eine Zeile
        // zusammengezogen — dieselbe Behandlung, die die Suchindex-Anzeige
        // dem Auszug gibt.
        const notiz = artikel.excerpt.replace(/\s+/g, " ").trim();
        zeilen.push(`- [${artikel.title}](${url})${notiz ? `: ${notiz}` : ""}`);
      }
    }
    zeilen.push("");
  }

  zeilen.push("## Company");
  zeilen.push("");
  zeilen.push(`- [About](${siteUrl("/ueber-uns")})`);
  zeilen.push(`- [Contact](${siteUrl("/kontakt")})`);
  zeilen.push(`- [Partner programme](${siteUrl("/partner")})`);
  zeilen.push("");

  zeilen.push("## Legal");
  zeilen.push("");
  zeilen.push(`- [Terms](${siteUrl("/agb")})`);
  zeilen.push(`- [Partner programme terms](${siteUrl("/partner/agb")})`);
  for (const eintrag of RECHTSDOKUMENTE) {
    zeilen.push(`- [${eintrag.slug}](${siteUrl(`/${eintrag.slug}`)})`);
  }
  zeilen.push(`- [Delete account](${siteUrl("/konto-loeschen")})`);
  zeilen.push("");

  zeilen.push("## Notes");
  zeilen.push("");
  zeilen.push(
    "- The operator dashboard is not publicly reachable; only the pages listed " +
      "here are.",
  );
  zeilen.push(`- Short version: ${siteUrl("/llms.txt")}`);
  zeilen.push(`- Sitemap: ${siteUrl("/sitemap.xml")}`);
  zeilen.push(
    `- Canonical host is ${siteUrl("/").replace(/\/$/, "")}; requests without ` +
      "www are redirected there.",
  );
  zeilen.push(
    `- Article count in this file: ${flattenArticles(kategorien).length}.`,
  );
  zeilen.push("");

  return new Response(zeilen.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
