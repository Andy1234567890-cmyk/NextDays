// Registry aller Rechtsdokumente dieser App.
//
// EINE Liste — Seiten, Footer, Sitemap und llms.txt lesen daraus, damit ein
// neues Dokument nicht an vier Stellen nachgetragen werden muss und kein Link
// ins Leere zeigt. Die Anzeigetexte im Footer kommen aus messages/<locale>.json
// (footer.*), gemappt über den slug — hier steht bewusst kein deutscher Text.
//
// SEIT 24.08.2026 STEHT HIER NUR DER SLUG, NICHT DER INHALT.
// Vorher importierte diese Datei die vier Dokumente als Module und gab sie mit
// (`{ doc: datenschutz }`). Das hatte zwei Folgen:
//   · Jede Seite mit Footer zog den vollständigen Text von vier Rechtstexten
//     ins Bundle, obwohl sie daraus nur den Slug brauchte.
//   · Und es band die Registry an EINE Sprachfassung. Genau daran hing der
//     Befund vom 24.08.2026: Datenschutz, Impressum, Cookie-Richtlinie und AVV
//     erschienen in allen 24 Sprachen auf Deutsch.
// Den Inhalt liefert jetzt `ladeRechtsdokument(slug, locale)` aus
// `content/legal/laden.ts` — sprachabhängig und erst dort, wo er gebraucht
// wird.
import type { RechtsdokumentSlug } from "./laden";

export type LegalEintrag = {
  /** Route ohne führenden Slash — gleichzeitig Schlüssel des Loaders. */
  slug: RechtsdokumentSlug;
};

// Reihenfolge = Reihenfolge im Footer.
//
// Die AGB stehen bewusst NICHT in dieser Liste, obwohl der Loader sie kennt:
// der Footer setzt sie an eine eigene, erste Position (`AGB_URL`), und Sitemap
// wie llms.txt führen sie über die statische Seitenliste. Sie hier zusätzlich
// aufzunehmen hieße, sie zweimal auszugeben.
export const RECHTSDOKUMENTE: LegalEintrag[] = [
  { slug: "datenschutz" },
  { slug: "impressum" },
  { slug: "cookie-richtlinie" },
  { slug: "auftragsverarbeitung" },
];

// Bewusst KEIN Re-Export von `ladeRechtsdokument`: diese Datei wird vom Footer
// importiert, also von jeder Seite. Ein Re-Export hätte den Loader mit seinen
// 5 × 24 Import-Pfaden in den Modulgraphen JEDER Seite gezogen — auch der
// Startseite, die von Rechtstexten nichts wissen muss. Wer den Inhalt braucht,
// importiert direkt aus `content/legal/laden`.
export type { RechtsdokumentSlug } from "./laden";
export type { LegalDoc } from "./types";
