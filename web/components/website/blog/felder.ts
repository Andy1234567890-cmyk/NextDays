// Der KATALOG der festen Beitragsfelder (0481).
//
// Grundlage: `docs/FRAMER-CMS-ANALYSE.md`, Abschnitt C1 — dort trägt jedes Feld
// Name, Beschreibung, Pflicht, ein-/mehrzeilig, Platzhalter und Maximallänge.
//
// EINE WAHRHEIT MIT DEM BACKEND
// =============================
// Die Schlüssel hier MÜSSEN deckungsgleich sein mit `BEITRAG_FELDER` in
// `apps/api/src/features/site_config/beitrag_felder.py`. Ein Schlüssel, den nur
// eine der beiden Seiten kennt, ist ein Feld, dessen Konfiguration mit 422
// abgelehnt wird — sichtbar erst beim Speichern, und dann sucht niemand den
// Fehler in einer Liste. Der Prüflauf `scripts/i18n/blog-felder-pruefen.mjs`
// hält beide Seiten gleich.
//
// WARUM `title` UND `status` FEHLEN
// =================================
// Beide sind bewusst NICHT konfigurierbar:
//   · der Titel ist die Identität des Beitrags — „nicht Pflicht" wäre keine
//     echte Option, ein Beitrag ohne Titel ist in keiner Liste auffindbar;
//   · der Status ist es im Vorbild ausdrücklich auch nicht (C1: „kein Popover
//     — das Feld ist nicht konfigurierbar").

/** Wie ein Feld sich in Tabelle und Dialog darstellt. */
export type FeldArt =
  | "text"
  | "richtext"
  | "bild"
  /** MEHRERE Bilder in einem Feld (Vorbild: `Gallery` mit `Min`/`Max`).
   *  Ein eigener Typ und nicht vier Einzelfelder — die Analyse hält das in
   *  Abschnitt G ausdrücklich fest. */
  | "galerie"
  | "datum"
  | "liste"
  /** Seite oder externe Adresse (Vorbild: `Link`, Platzhalter „Page or URL…"). */
  | "link"
  | "schalter";

export type FeldDef = {
  /** Der Schlüssel — dieselbe Zeichenkette wie im Backend. */
  key: string;
  /** i18n-Schlüssel des eingebauten Namens, unter `website.blog.*`. */
  i18n: string;
  art: FeldArt;
  /** Steht dieses Feld als Spalte in der Tabelle?
   *
   *  Im Vorbild ist JEDES Feld eine Spalte — auch Galerien, Abschlusstexte
   *  und die Karussellbilder. Was davon zu sehen ist, entscheidet nicht der
   *  Katalog, sondern die Spaltenwahl (`Show Columns`) und die Ansicht des
   *  einzelnen Bearbeiters.
   *
   *  Vorher stand hier eine eigene Auswahl („gehört in den Dialog, nicht in
   *  die Liste"). Das war meine Entscheidung und nicht die der Vorlage: sechs
   *  Felder fehlten dadurch in der Tabelle, ohne dass man sie einschalten
   *  konnte — eine Spaltenwahl, die die halben Spalten gar nicht kennt, ist
   *  keine Wahl. */
  spalte: boolean;
  /** Lässt sich der Wert DIREKT IN DER ZELLE ändern (Framer B8a: „Die Zelle
   *  ist das Eingabefeld")? Ein Bild und eine Schlagwortliste brauchen dafür
   *  mehr Platz als eine Zeile hat — sie öffnen den Dialog. */
  inlineEditierbar: boolean;
  /** Ist das Feld von Haus aus mehrzeilig? Der Betrieb kann es umstellen. */
  mehrzeilig?: boolean;
};

/** Die festen Felder eines Beitrags, in der Reihenfolge des Dialogs.
 *
 *  Die Liste und ihre Reihenfolge stammen aus der Feldliste des Vorbilds
 *  (Bildreihe vom 28.08.2026, `docs/FRAMER-CMS-ANALYSE.md` Abschnitt C):
 *
 *      Status · Project Thumbnail Title · Main Image / Thumbnail Image ·
 *      Show on the homepage · Slug · Industry · Client · Full Project Title ·
 *      Intro Section Heading · Intro Section Body · Button Text ·
 *      Website Link · Gallery Top · Gallery Side Left · Gallery Side Right ·
 *      Gallery Bottom · Final Section Heading · Final Section Body ·
 *      Show Image Carousel · Carousel Img 1–4 · Created · Updated
 *
 *  `Status`, `Project Thumbnail Title` und `Slug` stehen NICHT als
 *  konfigurierbare Einträge darin: der Status ist im Vorbild ausdrücklich
 *  nicht konfigurierbar (C1: „kein Popover"), Titel und Adresse sind die
 *  Identität des Beitrags. Sie werden im Dialog trotzdem gezeigt — nur eben
 *  ohne Einstellungen.
 *
 *  `Created` und `Updated` sind schreibgeschützt (C: „ein Klick setzt nur den
 *  Auswahlrahmen, ein Doppelklick öffnet kein Eingabefeld").
 */
export const BEITRAG_FELDER: readonly FeldDef[] = [
  // --- Kopf: Bild und Sichtbarkeit ----------------------------------------
  {
    key: "cover",
    i18n: "blog.titelbild",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "show_on_homepage",
    i18n: "blog.aufStartseite",
    art: "schalter",
    spalte: true,
    // Ein Schalter IST die Bedienung — ein Klick schreibt sofort (B8a).
    inlineEditierbar: true,
  },

  // --- Einordnung ----------------------------------------------------------
  {
    key: "industry",
    i18n: "blog.felder.branche",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
  },
  {
    key: "client",
    i18n: "blog.felder.kunde",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
  },
  {
    key: "full_title",
    i18n: "blog.felder.vollerTitel",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
  },

  // --- Einleitung ----------------------------------------------------------
  {
    key: "intro_heading",
    i18n: "blog.felder.introUeberschrift",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
    mehrzeilig: true,
  },
  {
    key: "intro_body",
    i18n: "blog.felder.introText",
    art: "text",
    spalte: true,
    inlineEditierbar: false,
    mehrzeilig: true,
  },

  // --- Handlungsaufforderung ----------------------------------------------
  {
    key: "button_text",
    i18n: "blog.felder.buttonText",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
  },
  {
    key: "website_link",
    i18n: "blog.felder.websiteLink",
    art: "link",
    spalte: true,
    inlineEditierbar: true,
  },

  // --- Galerien ------------------------------------------------------------
  //
  // `Gallery Top` und `Gallery Bottom` sind MEHRERE Bilder (Typ `galerie`,
  // im Vorbild mit `Min`/`Max`), `Side Left`/`Side Right` sind EINZELBILDER.
  // Die Analyse hält das ausdrücklich fest (C, Feld 14/15: „**Image** (nicht
  // Gallery!)") — wer alle vier gleich baut, baut zwei davon falsch.
  {
    key: "gallery_top",
    i18n: "blog.felder.galerieOben",
    art: "galerie",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "gallery_left",
    i18n: "blog.felder.galerieLinks",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "gallery_right",
    i18n: "blog.felder.galerieRechts",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "gallery_bottom",
    i18n: "blog.felder.galerieUnten",
    art: "galerie",
    spalte: true,
    inlineEditierbar: false,
  },

  // --- Abschluss -----------------------------------------------------------
  {
    key: "final_heading",
    i18n: "blog.felder.finalUeberschrift",
    art: "text",
    spalte: true,
    inlineEditierbar: false,
    mehrzeilig: true,
  },
  {
    key: "final_body",
    i18n: "blog.felder.finalText",
    art: "text",
    spalte: true,
    inlineEditierbar: false,
    mehrzeilig: true,
  },

  // --- Bildkarussell -------------------------------------------------------
  {
    key: "show_carousel",
    i18n: "blog.felder.karussellZeigen",
    art: "schalter",
    spalte: true,
    inlineEditierbar: true,
  },
  {
    key: "carousel_1",
    i18n: "blog.felder.karussell1",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "carousel_2",
    i18n: "blog.felder.karussell2",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "carousel_3",
    i18n: "blog.felder.karussell3",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "carousel_4",
    i18n: "blog.felder.karussell4",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },

  // --- Unsere bestehenden Beitragsfelder -----------------------------------
  //
  // Anriss, Autor, Schlagwörter, Datum und Text gibt es im Vorbild nicht —
  // seine Beispiel-Collection ist ein Portfolio, unsere ist ein Blog. Sie
  // bleiben, weil ohne sie kein Beitrag entsteht.
  {
    key: "excerpt",
    i18n: "blog.anriss",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
    mehrzeilig: true,
  },
  {
    key: "author",
    i18n: "blog.autor",
    art: "text",
    spalte: true,
    inlineEditierbar: true,
  },
  {
    key: "tags",
    i18n: "blog.schlagwoerter",
    art: "liste",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "published",
    i18n: "blog.datum",
    art: "datum",
    spalte: true,
    inlineEditierbar: true,
  },
  {
    key: "content",
    i18n: "blog.cm.text",
    art: "richtext",
    // Auch der Beitragstext ist eine SPALTE — im Vorbild ist jedes Feld eine,
    // und die Spaltenwahl (`Show Columns`) entscheidet, was davon sichtbar
    // ist. Die Zelle zeigt einen Textauszug, nicht das HTML.
    spalte: true,
    inlineEditierbar: false,
  },

  // --- Beitrags-SEO --------------------------------------------------------
  {
    key: "seo_title",
    i18n: "blog.cm.seoTitel",
    art: "text",
    spalte: true,
    inlineEditierbar: false,
  },
  {
    key: "seo_description",
    i18n: "blog.cm.seoBeschreibung",
    art: "text",
    spalte: true,
    inlineEditierbar: false,
    mehrzeilig: true,
  },
  {
    key: "og_image",
    i18n: "blog.vorschaubild",
    art: "bild",
    spalte: true,
    inlineEditierbar: false,
  },
] as const;

/** Felder, die KEINEN Vorgabewert annehmen (0486) — gleichlautend mit
 *  `OHNE_VORGABE` im Backend.
 *
 *  Ein Schalter hat schon einen Grundzustand; ein Bild, eine Galerie und eine
 *  Schlagwortliste sind keine Eingabe, die man vorschreiben könnte. Eine
 *  Vorgabe-Zeile an ihnen wäre eine Einstellung ohne Wirkung. */
export const OHNE_VORGABE: ReadonlySet<string> = new Set([
  "cover",
  "og_image",
  "show_on_homepage",
  "show_carousel",
  "tags",
  "gallery_top",
  "gallery_bottom",
  "gallery_left",
  "gallery_right",
  "carousel_1",
  "carousel_2",
  "carousel_3",
  "carousel_4",
]);

/** Felder, die sich nicht ausblenden lassen — gleichlautend mit
 *  `NICHT_VERSTECKBAR` im Backend. Ohne den Text entsteht kein Beitrag. */
export const NICHT_VERSTECKBAR: ReadonlySet<string> = new Set(["content"]);

/** Die gespeicherte Abweichung EINES Feldes (0481). */
export type FeldKonfig = {
  feld_key: string;
  /** `null` = der eingebaute Name aus dem Katalog. */
  label: string | null;
  beschreibung: string | null;
  platzhalter: string | null;
  max_zeichen: number | null;
  pflicht: boolean;
  mehrzeilig: boolean;
  versteckt: boolean;
  /** Fester Vorgabewert (0486, Framers „Default"). Wirkt beim ANLEGEN eines
   *  Beitrags und beim Zurücksetzen — nie als Ersatzwert beim Lesen. */
  standard_wert: string | null;
  /** Vorgabe ABGELEITET aus einem anderen Feld (Framers „Based on"). Genau
   *  eines von beiden ist gesetzt; der Server lehnt beides zugleich ab. */
  standard_feld: string | null;
};

/** Die Vorgabe eines Feldes, das noch keine gespeicherte Zeile hat.
 *
 *  Sie steht HIER und nicht im Backend: dort wäre es ein zweiter, erfundener
 *  Satz Vorgabewerte neben diesem Katalog (Wurzel 2/4). Das Backend liefert
 *  deshalb ausschließlich gespeicherte Abweichungen. */
export function vorgabeKonfig(def: FeldDef): FeldKonfig {
  return {
    feld_key: def.key,
    label: null,
    beschreibung: null,
    platzhalter: null,
    max_zeichen: null,
    pflicht: false,
    mehrzeilig: def.mehrzeilig ?? false,
    versteckt: false,
    standard_wert: null,
    standard_feld: null,
  };
}

/** Die geltende Konfiguration eines Feldes: gespeicherte Abweichung, sonst die
 *  Vorgabe aus dem Katalog. */
export function konfigVon(
  def: FeldDef,
  gespeichert: readonly FeldKonfig[],
): FeldKonfig {
  return (
    gespeichert.find((k) => k.feld_key === def.key) ?? vorgabeKonfig(def)
  );
}
