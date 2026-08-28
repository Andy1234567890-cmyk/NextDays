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
import { istSprache, mitSprache } from "./sprache";
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
/** Absolute Adresse aus Basis + Pfad. `/` bleibt die nackte Basis, sonst
 *  entstünde `https://host//` mit doppeltem Schrägstrich. */
function absolutMit(basis: string, pfad: string): string {
  return pfad === "/" ? basis : `${basis}${pfad}`;
}

/** Die Sprachen, für die diese Website hreflang ausgeben darf.
 *
 *  NUR die tatsächlich eingerichteten (`branding.languages`) — bewusst NICHT
 *  der Rückfall auf alle 24 aus `sprachenDerSite`. Der Unterschied ist hier
 *  entscheidend: hreflang ist ein Versprechen an Google, dass es unter dieser
 *  Adresse eine Fassung in dieser Sprache gibt. 24 Sprachen anzukündigen, von
 *  denen 22 auf denselben deutschen Text zeigen, ist genau der Duplikatfall,
 *  den Google beschreibt („only considered duplicates if the main content
 *  remains untranslated") — und er trifft dann alle 24 Adressen.
 *
 *  Eine einzige Sprache bekommt gar kein hreflang: die Annotation beschreibt
 *  ein Verhältnis, und ein Verhältnis zu sich selbst sagt nichts. */
function sprachenFuerHreflang(
  branding: SiteBranding | null | undefined,
): string[] {
  const gefuehrt = (branding?.languages ?? []).filter(istSprache);
  if (gefuehrt.length === 0) return [];
  const standard = branding?.default_language;
  // Die STANDARDSPRACHE gehört immer dazu, auch wenn sie nicht in
  // `languages` steht.
  //
  // Sonst entsteht ein unvollständiger Satz: bei `default_language=de` und
  // `languages=["da","en"]` würden `/da/…` und `/en/…` gelistet, aber
  // `/kontakt` — die deutsche Fassung, auf die x-default zeigt — trüge keinen
  // eigenen Sprachcode. Google verlangt, dass jede Fassung sich selbst listet,
  // und verwirft den ganzen Satz, wenn ein Rückverweis fehlt.
  if (istSprache(standard) && !gefuehrt.includes(standard)) {
    return [standard, ...gefuehrt];
  }
  return gefuehrt;
}

/** Die hreflang-Karte für EINEN Pfad.
 *
 *  Öffentlich, weil Beiträge (`/blog/<slug>`) und Objektseiten
 *  (`/inserat/<id>`) dieselbe Karte brauchen, ihre Metadaten aber nicht über
 *  `seitenMetadaten` bauen — sie kennen andere Pfadformen. Eine zweite Kopie
 *  dieser Schleife wäre die Stelle, an der x-default beim nächsten Mal
 *  vergessen wird (Wurzel 2).
 *
 *  `undefined` bei weniger als zwei geführten Sprachen: hreflang beschreibt
 *  ein Verhältnis, und ein Verhältnis zu sich selbst sagt nichts. */
export function hreflangKarte(
  branding: SiteBranding | null | undefined,
  host: string,
  pfad: string,
): Record<string, string> | undefined {
  const gefuehrt = sprachenFuerHreflang(branding);
  if (gefuehrt.length < 2) return undefined;
  const basis = basisUrl(host);
  const standard = branding?.default_language ?? null;
  return {
    ...Object.fromEntries(
      gefuehrt.map((l) => [
        l,
        absolutMit(basis, mitSprache(pfad, l, standard)),
      ]),
    ),
    "x-default": absolutMit(basis, pfad),
  };
}

export function seitenMetadaten({
  branding,
  host,
  page,
  sprache,
}: {
  branding: SiteBranding | null | undefined;
  host: string;
  page: PageMeta;
  /** Die Sprache DIESER Fassung. Fehlt sie, gilt die Standardsprache der
   *  Website — dann ist die Seite ihre eigene Standardfassung. */
  sprache?: string | null;
}): Metadata {
  const basis = basisUrl(host);
  const pfad = seitenPfad(page.slug);
  const standard = branding?.default_language ?? null;
  // Die Adresse DIESER Fassung. In der Standardsprache ohne Präfix — genau so,
  // wie `mitSprache` sie baut, sonst zeigte der Canonical auf eine Adresse, die
  // es nicht gibt.
  const eigenerPfad = mitSprache(pfad, sprache, standard);
  const absolut =
    eigenerPfad === "/" ? basis : `${basis}${eigenerPfad}`;

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
      //
      // „Ihr eigenes Original" heißt seit 0476: DIESE Sprachfassung, nicht die
      // Standardfassung. Ein Canonical von `/da/kontakt` auf `/kontakt` würde
      // Google sagen „die dänische Seite ist eine Kopie der deutschen" — und
      // sie aus dem Index nehmen. Das wäre die Selbstzerstörung der
      // Übersetzung: der Text wäre da, gefunden würde er nie.
      canonical: page.canonical_url?.trim() || absolut,
      // hreflang. Jede Fassung listet SICH SELBST und alle anderen — Google
      // ignoriert den ganzen Satz, wenn ein Rückverweis fehlt („bidirectional
      // confirmation"). Deshalb wird die Liste hier vollständig gebaut und
      // nicht je Seite zusammengestückelt.
      //
      // `x-default` zeigt auf die Standardfassung: sie gilt für Besucher, deren
      // Sprache wir nicht führen. Kein Rückfall auf Englisch — `x-default`
      // beantwortet „ich habe keine Fassung für dich", nicht „nimm Englisch".
      languages: hreflangKarte(branding, host, pfad),
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
  // Der Alt-Text gilt NUR für das Bild der Seite (0457). Fällt die Vorschau auf
  // das Titelbild der Website zurück, beschriebe er ein anderes Bild — und ein
  // falscher Alternativtext ist schlechter als keiner.
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
    ...(bild
      ? {
          images: [
            {
              url: bild,
              ...(page.og_image_url?.trim() && page.og_image_alt?.trim()
                ? { alt: page.og_image_alt.trim() }
                : {}),
            },
          ],
        }
      : {}),
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
