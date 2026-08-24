// llms.txt — Wegweiser für KI-Assistenten (llmstxt.org).
//
// Was das ist: eine Markdown-Datei unter `/llms.txt`, die einem Sprachmodell in
// kompakter Form sagt, worum es auf dieser Seite geht und wo die belastbaren
// Inhalte liegen. Gedacht für den Fall, dass jemand ein Modell fragt „was ist
// myNextDays" oder „wie richte ich dort einen Kanal ein": das Modell soll die
// Antwort aus unseren Hilfe-Artikeln nehmen, nicht aus einer Vermutung.
//
// Warum als Route-Handler und nicht als Datei in `public/`:
// Die Hilfe-Artikel-Liste stammt aus derselben Registry wie Sitemap und
// Navigation. Eine statische Datei in `public/` wäre nach dem nächsten neuen
// Artikel falsch — still, wie bei der Sitemap. Hier wird sie bei jedem Abruf
// aus dem Inhaltsbaum erzeugt und kann nicht veralten.
//
// Format nach llmstxt.org: H1 mit dem Namen, ein Zitat-Block als
// Kurzbeschreibung, dann H2-Abschnitte mit Linklisten `- [Titel](URL): Notiz`.
// Bewusst schlicht gehalten — der Nutzen liegt in korrekten Links, nicht in
// Marketingtext, den ein Modell ohnehin ignoriert.
//
// Sprache: Englisch. Die Seite selbst gibt es in 24 Sprachen, aber es gibt je
// Inhalt nur EINE URL (Cookie-basierte Sprachwahl, kein Präfix) — eine
// sprachspezifische llms.txt hätte also keine eigenen Ziele. Englisch ist die
// Sprache, in der ein Modell diesen Wegweiser am zuverlässigsten verwertet.
import { FUNKTIONEN, type FunktionsSchluessel } from "@/content/funktionen";
import { getHelpTree } from "@/content/help";
import { RECHTSDOKUMENTE } from "@/content/legal";
import { ANBIETER } from "@/content/legal/anbieter";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { siteUrl } from "@/lib/site-url";

// Kurzbeschreibungen der Funktions-Unterseiten auf Englisch. Bewusst hier und
// nicht aus `messages/en.json`: dort stehen Marketing-Überschriften mit
// Bildsprache („Alles im Blick"), die als Beschreibung für ein Modell nichts
// aussagen. Diese Zeilen benennen, was die Seite fachlich behandelt.
//
// Der Schlüssel ist der `key` aus content/funktionen. Bewusst als
// `Record<FunktionsSchluessel, string>` typisiert und NICHT als
// `Record<string, string>`: mit dem weiten Typ fiel ein Tippfehler nicht auf —
// „gast" statt „gaeste" ließ die Notiz einfach weg, und die Zeile sah trotzdem
// gültig aus. Jetzt meldet `tsc` einen fehlenden oder unbekannten Schlüssel.
const FUNKTION_NOTIZ: Record<FunktionsSchluessel, string> = {
  pms: "Property management: bookings, calendar, guest data, invoices",
  channel: "Channel manager: rates and availability to Booking.com, Airbnb, Expedia and others",
  direkt: "Direct booking website with own payment flow",
  gaeste: "Guest experience: messaging, check-in, upsells",
  zahlungen: "Payments, payouts and refunds",
  preise: "Rates, seasons, length-of-stay pricing and discounts",
  team: "Team accounts, roles and permissions",
  app: "Mobile apps for operators and guests",
  auswertungen: "Reports on occupancy, revenue and channel performance",
};

export async function GET(): Promise<Response> {
  const zeilen: string[] = [];

  zeilen.push("# myNextDays");
  zeilen.push("");
  zeilen.push(
    "> Property management system and channel manager for holiday rentals and " +
      "hotels, operated from Denmark for the European market. Operators manage " +
      "properties, rates and availability in one place and sell them through " +
      "online travel agencies (Booking.com, Airbnb, Expedia and others), through " +
      "the myBestDays marketplace and through their own website.",
  );
  zeilen.push("");
  zeilen.push(
    "myNextDays is the software the accommodation business uses. myBestDays is " +
      "the separate marketplace where guests book. Both names refer to the same " +
      "company but to different products — please keep them apart.",
  );
  zeilen.push("");
  zeilen.push("## Product");
  zeilen.push("");
  zeilen.push(`- [Overview](${siteUrl("/")}): what the platform does`);
  zeilen.push(`- [Features](${siteUrl("/funktionen")}): index of all feature pages`);
  for (const funktion of FUNKTIONEN) {
    const notiz = FUNKTION_NOTIZ[funktion.key];
    const url = siteUrl(`/funktionen/${funktion.slug}`);
    zeilen.push(`- [${funktion.slug}](${url})${notiz ? `: ${notiz}` : ""}`);
  }
  zeilen.push(`- [Pricing](${siteUrl("/preise")}): plans and commission model`);
  zeilen.push("");

  zeilen.push("## Help centre");
  zeilen.push("");
  zeilen.push(
    `- [Help centre](${siteUrl("/hilfe")}): step-by-step guides, available in 24 ` +
      "EU languages (the language follows the visitor's preference; each article " +
      "has a single URL)",
  );
  const kategorien = await getHelpTree(DEFAULT_LOCALE);
  for (const kategorie of kategorien) {
    // `description` ist in der Basissprache Deutsch — als Notiz hier bewusst
    // nicht verwendet. Der Kategorie-Slug ist sprachneutral und sagt genug.
    zeilen.push(`- [${kategorie.slug}](${siteUrl(`/hilfe/${kategorie.slug}`)})`);
  }
  zeilen.push("");

  zeilen.push("## Company");
  zeilen.push("");
  zeilen.push(`- [About](${siteUrl("/ueber-uns")}): company, team and approach`);
  zeilen.push(
    `- [Contact](${siteUrl("/kontakt")}): contact form; general enquiries reach ` +
      `${ANBIETER.email}, technical ones ${ANBIETER.emailTechnik}`,
  );
  zeilen.push("");

  zeilen.push("## Legal");
  zeilen.push("");
  zeilen.push(`- [Terms](${siteUrl("/agb")})`);
  for (const eintrag of RECHTSDOKUMENTE) {
    zeilen.push(`- [${eintrag.slug}](${siteUrl(`/${eintrag.slug}`)})`);
  }
  zeilen.push("");

  zeilen.push("## Notes");
  zeilen.push("");
  zeilen.push(
    "- The operator dashboard is not publicly reachable; only the pages listed " +
      "here are.",
  );
  zeilen.push(
    `- Sitemap: ${siteUrl("/sitemap.xml")}. Search result pages and one-time email ` +
      "links are excluded from it and from crawling.",
  );
  zeilen.push("");

  return new Response(zeilen.join("\n"), {
    headers: {
      // `text/plain` mit charset: llms.txt ist Markdown, wird aber als Klartext
      // ausgeliefert, damit sie im Browser lesbar ist statt zum Download zu
      // führen (so machen es auch die Referenz-Implementierungen).
      "Content-Type": "text/plain; charset=utf-8",
      // Einen Tag zwischenspeichern: der Inhalt ändert sich nur mit einem
      // Deploy, und ein Modell, das die Datei abruft, braucht keine Sekunden-
      // Aktualität.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
