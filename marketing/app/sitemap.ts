// Sitemap für Suchmaschinen — erzeugt aus den Registries, nicht von Hand.
//
// Warum abgeleitet statt getippt: Die Seite hat neun Funktions-Unterseiten, vier
// Rechtsdokumente und rund hundert Hilfe-Artikel in 24 Sprachen. Eine
// handgepflegte Liste wäre nach dem nächsten neuen Artikel falsch — und zwar
// still, weil eine unvollständige Sitemap keinen Fehler erzeugt, sondern nur
// dafür sorgt, dass Google die fehlenden Seiten nicht findet.
//
// Ausgeschlossen sind bewusst:
//   • `/hilfe/suche` — eine Suchergebnisseite, die je Parameter anderen Inhalt
//     zeigt. Solche Seiten gehören nicht in den Index (Duplicate Content).
//   • `/newsletter/bestaetigen`, `/newsletter/abmelden`,
//     `/konto-loeschen/bestaetigen` — Ziele von Einmal-Links aus E-Mails. Ohne
//     Token zeigen sie nur eine Fehlermeldung; indexiert wären sie ein
//     Suchtreffer, der nichts kann.
//
// Sprachen: Die Seite hat KEIN URL-Präfix je Sprache (Cookie-basiert, siehe
// i18n/locales.ts), es gibt also genau eine URL je Inhalt. Deshalb keine
// `alternates`-Einträge — die würden Sprachvarianten behaupten, die als eigene
// Adresse nicht existieren.
import type { MetadataRoute } from "next";

import { FUNKTIONEN } from "@/content/funktionen";
import { flattenArticles, getHelpTree } from "@/content/help";
import { RECHTSDOKUMENTE } from "@/content/legal";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { siteUrl } from "@/lib/site-url";

// Statische Seiten mit ihrer Gewichtung. `priority` ist ein Hinweis, keine
// Zusage — die Startseite steht oben, Rechtstexte unten.
const STATISCH: { pfad: string; priority: number }[] = [
  { pfad: "/", priority: 1 },
  { pfad: "/funktionen", priority: 0.9 },
  { pfad: "/preise", priority: 0.9 },
  { pfad: "/hilfe", priority: 0.8 },
  { pfad: "/ueber-uns", priority: 0.7 },
  { pfad: "/kontakt", priority: 0.7 },
  // Entwickler-Dokumentation der öffentlichen API. Gehört in den Index: wer
  // nach „myNextDays API" sucht, ist ein potenzieller Integrationspartner. Die
  // interaktive Referenz selbst (open-api.mynextdays.com/docs) steht NICHT hier — sie
  // liegt auf einer anderen Domain und hat ihre eigene robots-Regel.
  { pfad: "/entwickler", priority: 0.6 },
  { pfad: "/agb", priority: 0.3 },
  { pfad: "/konto-loeschen", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Ein Zeitstempel für den ganzen Lauf: `lastModified` beschreibt hier den
  // Stand der Auslieferung, nicht die letzte Änderung des einzelnen Artikels —
  // die kennen wir nicht, weil die Inhalte im Code liegen und kein
  // Änderungsdatum tragen. Pro Eintrag eine eigene `new Date()` zu setzen wäre
  // dieselbe Zahl mit dem falschen Anspruch (Wurzel 5b: nicht unsere Uhr als
  // Zeitpunkt eines anderen Ereignisses ausgeben).
  const stand = new Date();

  const eintraege: MetadataRoute.Sitemap = STATISCH.map(({ pfad, priority }) => ({
    url: siteUrl(pfad),
    lastModified: stand,
    changeFrequency: pfad === "/" ? "weekly" : "monthly",
    priority,
  }));

  for (const funktion of FUNKTIONEN) {
    eintraege.push({
      url: siteUrl(`/funktionen/${funktion.slug}`),
      lastModified: stand,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const eintrag of RECHTSDOKUMENTE) {
    eintraege.push({
      url: siteUrl(`/${eintrag.doc.slug}`),
      lastModified: stand,
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  // Hilfe-Center: Kategorien und Artikel. Die Struktur ist in allen Sprachen
  // identisch (gleiche slugs, nur übersetzte Texte), deshalb genügt der Baum
  // der Basissprache, um alle URLs zu kennen.
  const kategorien = await getHelpTree(DEFAULT_LOCALE);
  for (const kategorie of kategorien) {
    eintraege.push({
      url: siteUrl(`/hilfe/${kategorie.slug}`),
      lastModified: stand,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  for (const { category, article } of flattenArticles(kategorien)) {
    eintraege.push({
      url: siteUrl(`/hilfe/${category.slug}/${article.slug}`),
      lastModified: stand,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return eintraege;
}
