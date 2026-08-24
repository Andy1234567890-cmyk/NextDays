// Die <head>-Angaben einer Kunden-Seite (0430) — an EINER Stelle.
//
// Vorher setzte nur das Root-Layout einen Titel: den Namen der Website, für
// jede Seite denselben. Damit trug jede Unterseite im Browser-Tab und im
// Suchergebnis dieselbe Zeile — für Google ist das das Kennzeichen einer
// Website ohne Struktur, und für einen Gast mit fünf offenen Tabs sind es fünf
// identische Beschriftungen.
//
// Warum ein eigenes Modul und nicht zwei `generateMetadata`-Funktionen: die
// Startseite und die Unterseite brauchen genau dasselbe, unterscheiden sich nur
// im Pfad. Zwei Kopien wären zwei Stellen, an denen ein Canonical falsch werden
// kann — und ein falscher Canonical nimmt die Seite aus dem Index.
import type { Metadata } from "next";

import { basisUrl, seitenPfad } from "./seo";
import type { PageMeta } from "./site";
import type { SiteBranding } from "./site-context";

/** Metadaten einer im Baukasten komponierten Seite.
 *
 *  `page` trägt die BEREITS aufgelösten SEO-Werte (Seite schlägt Website; die
 *  Hierarchie liegt im Backend-Resolver). Hier wird nur noch in das Format
 *  gebracht, das Next erwartet — und entschieden, was WEGGELASSEN wird.
 *
 *  Der Grundsatz dabei: fehlt eine Angabe, fehlt sie auch im HTML. Kein Titel
 *  aus dem Seitennamen, keine Beschreibung aus dem ersten Absatz, kein
 *  Platzhalterbild (Wurzel 4). Eine erfundene Meta-Beschreibung ist schlechter
 *  als keine — Google schreibt sich sonst selbst eine aus dem Seitentext, und
 *  die passt fast immer besser als ein generischer Satz. */
export function seitenMetadaten({
  branding,
  host,
  page,
}: {
  branding: SiteBranding | null | undefined;
  host: string;
  page: PageMeta;
}): Metadata {
  const basis = basisUrl(host);
  const pfad = seitenPfad(page.slug);
  const absolut = pfad === "/" ? basis : `${basis}${pfad}`;

  // Der Titel für Tab und Suchergebnis. `seo_title` zuerst — er ist die für
  // Suchmaschinen formulierte Fassung. Danach der Seitenname: er ist kein
  // erfundener Wert, sondern der echte Name dieser Seite, und ein Tab ohne
  // Beschriftung ist für niemanden hilfreich.
  //
  // Der Name der Website hängt hinten dran, aber NUR bei Unterseiten und nur,
  // wenn er nicht schon im Titel steht: „Über uns — Nordlicht" ist die Form,
  // die in Suchergebnissen erwartet wird. Auf der Startseite wäre „Nordlicht —
  // Nordlicht" die Folge.
  const roh = page.seo_title?.trim() || page.title?.trim() || null;
  const marke = branding?.site_name?.trim() || null;
  const titel =
    roh && marke && pfad !== "/" && !roh.toLowerCase().includes(marke.toLowerCase())
      ? `${roh} — ${marke}`
      : roh || marke;

  const beschreibung = page.seo_description?.trim() || null;
  // `tagline` ist BEWUSST kein Rückfall für die Beschreibung: ein Slogan
  // („Ferien wie früher") beschreibt nicht den Inhalt einer Seite. Als
  // Meta-Beschreibung auf jeder Unterseite wäre er genau die Dublette, die
  // Google als Vernachlässigung liest.

  const stichworte = page.seo_keywords
    ?.split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  const meta: Metadata = {
    // Die Basis für alle relativen Adressen in dieser Antwort. Ohne sie wären
    // `openGraph.url` und `alternates.canonical` relativ — und ein relativer
    // Canonical ist für Google wertlos.
    metadataBase: new URL(basis),
    alternates: {
      // Der Canonical der Seite. `canonical_url` gewinnt, wenn der Kunde einen
      // gesetzt hat (Kampagnen-Duplikat, Umzug mit Altbestand); sonst ist die
      // Seite ihr eigenes Original.
      canonical: page.canonical_url?.trim() || absolut,
    },
  };

  if (titel) meta.title = titel;
  if (beschreibung) meta.description = beschreibung;
  if (stichworte && stichworte.length > 0) meta.keywords = stichworte;

  // `noindex` ist die einzige Angabe, die AKTIV gesetzt wird, auch wenn sie
  // „aus" bedeutet — denn sie bedeutet nicht „aus", sondern „diese Seite nicht
  // aufnehmen". Fehlt das Tag, indexiert Google; Weglassen ist hier also die
  // Gegenaussage und kein Verzicht.
  if (page.noindex) {
    meta.robots = { index: false, follow: true };
  } else {
    // Vorschau-Freigaben für den indexierten Fall: ohne sie zeigt Google in
    // vielen Ländern nur ein Miniaturbild und einen abgeschnittenen Auszug.
    meta.robots = {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    };
  }

  const bild = page.og_image_url?.trim() || branding?.hero_image_url?.trim();
  meta.openGraph = {
    type: "website",
    url: absolut,
    ...(marke ? { siteName: marke } : {}),
    ...(titel ? { title: titel } : {}),
    ...(beschreibung ? { description: beschreibung } : {}),
    // Das Titelbild der Seite, sonst das der Website. Anders als bei der
    // Beschreibung ist dieser Rückfall richtig: ein Vorschaubild ist eine
    // Bebilderung, keine Aussage über den Inhalt — und ein Link ohne Bild wird
    // in jedem Messenger als graue Fläche geteilt.
    ...(bild ? { images: [{ url: bild }] } : {}),
  };
  meta.twitter = {
    // `summary_large_image` nur mit Bild: ohne eines zeigt X eine leere,
    // bildschirmbreite Fläche statt der kompakten Karte.
    card: bild ? "summary_large_image" : "summary",
    ...(titel ? { title: titel } : {}),
    ...(beschreibung ? { description: beschreibung } : {}),
    ...(bild ? { images: [bild] } : {}),
  };

  return meta;
}
