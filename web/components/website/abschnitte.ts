// Der Abschnitts-Katalog — EINE Wahrheit für den ganzen Baukasten.
//
// Eine Seite ist eine geordnete Liste von Abschnitten, kein freies Canvas. Der
// Kunde stapelt sie, sortiert sie und füllt ihre Felder; Position, Breite und
// Layout entscheidet das Theme. Genau deshalb kann er die Seite nicht zerlegen.
//
// Jeder Eintrag beschreibt seinen Typ vollständig: Gruppe, Icon, i18n-Schlüssel
// und die FELDER, die der Kunde bearbeiten darf. Der Inspektor rendert daraus
// automatisch das Formular — ein neuer Abschnitt braucht also keine zweite
// Formular-Datei, die man vergessen kann.
//
// Die Typen decken sich mit BlockType (Backend `schemas.py`) und dem Renderer
// (`builder/components/blocks/`). Ein Typ, der hier fehlt, ist im Baukasten
// unerreichbar; ein Typ, den es hier zu viel gibt, würde beim Speichern als 422
// zurückkommen.
import type { BlockType } from "@/lib/site-pages";

/** Gruppen des „Abschnitt hinzufügen"-Dialogs. Reihenfolge = Anzeigeordnung.
 *
 *  `layout` steht ZUERST, weil man den Rahmen vor dem Inhalt setzt — dieselbe
 *  Ordnung wie bei Framer (Frame · Stack · Grid · Masonry stehen dort oben im
 *  Einfügemenü) und bei Hostaway („Layout" vor „Basic"). */
export const GRUPPEN = [
  "layout",
  "inhalt",
  "buchung",
  "medien",
  "sonstiges",
] as const;
export type Gruppe = (typeof GRUPPEN)[number];

/** Feldarten, die der Inspektor kennt. Absichtlich wenige: jede Art, die
 *  dazukommt, ist eine Art, die der Kunde lernen muss. */
export type FeldArt =
  | "text" // einzeilig, MEHRSPRACHIG (Locale-Map)
  // Einzeilig, EINSPRACHIG (flacher String). Für Werte, die keine Übersetzung
  // haben: E-Mail, Telefon, ein Filterbegriff. Die Unterscheidung ist keine
  // Kosmetik — das Backend erwartet an diesen Feldern einen String, und eine
  // Locale-Map dort lässt das Speichern der GANZEN Seite mit 400 scheitern.
  | "einfachtext"
  | "textlang" // mehrzeilig, mehrsprachig
  | "richtext" // formatierter Text, mehrsprachig
  | "bild" // eine Bild-URL
  | "bilder" // Liste von Bild-URLs
  | "link" // href
  | "zahl"
  | "schalter"
  | "auswahl"
  | "objekte" // Auswahl eigener Objekte
  // Liste von Frage-Antwort-Paaren, beide MEHRSPRACHIG (0431). Eigene Art und
  // nicht „textlang" mit Konvention: aus einem Textfeld lässt sich nicht
  // ableiten, was Frage und was Antwort ist — und genau diese Trennung ist der
  // Grund für den Abschnitt (sie erzeugt das FAQPage-JSON-LD).
  | "fragen"
  // Liste von Gästestimmen: Zitat (mehrsprachig) + Name + Ort (0432).
  | "stimmen"
  // Liste von Merkmalen: Symbol + Überschrift + Text (0432).
  | "merkmale"
  // Ein Symbol aus der festen Auswahl (0432). Kein freies Iconify-Feld: ein
  // Name, den der Renderer nicht kennt, zeigt nichts an, und niemand käme
  // darauf, dass er sich vertippt hat.
  | "symbol"
  // Liste von Formularfeldern: Name, Art, Beschriftung, Pflicht (0436),
  // dazu die Seite, auf der das Feld steht (0445).
  | "formfelder"
  // Die Seiten eines mehrstufigen Formulars (0445): je Seite ein Titel,
  // mehrsprachig. Eigene Art und nicht „liste mit einem Unterfeld": die Anzahl
  // der Eintraege ist hier keine Kosmetik, sondern legt fest, welche Seiten es
  // im Formular GIBT — und damit, was die Feldliste darunter zur Auswahl
  // stellt.
  | "formularseiten"
  // --- 0450 ---------------------------------------------------------------
  // Die GENERISCHE Liste: der Katalog beschreibt die Unterfelder eines
  // Eintrags (`unterfelder`), der Inspektor baut daraus die Zeile.
  //
  // Eingeführt, weil die Basis-Widgets sonst acht weitere Einzel-Feldarten
  // gebraucht hätten (Klapp-Einträge, Reiter, Listenposten, Dateien, …) —
  // jede mit eigener Komponente, eigenem Sortierknopf und eigenem
  // Sprachwähler, und alle acht fast gleich. Die bestehenden Sonder-Arten
  // (`fragen`, `stimmen`, `merkmale`, `formfelder`) bleiben, wo sie sind:
  // sie funktionieren, sie sind übersetzt, und sie umzubauen wäre eine
  // Änderung an gepflegten Kundendaten ohne Nutzen.
  | "liste"
  // Eine Tabelle aus reinem Text. Eigene Art und nicht `liste`: eine Zeile
  // ist hier kein Objekt mit benannten Feldern, sondern eine Reihe von
  // Zellen, deren Anzahl der Kunde bestimmt.
  | "tabelle"
  // Ein Zeitpunkt mit Datum UND Uhrzeit (Countdown). Nicht `einfachtext`:
  // ein frei getipptes Datum wäre in jedem Land ein anderes Format, und das
  // Backend lehnt alles ab, was es nicht als ISO-8601 lesen kann.
  | "datumzeit";

/** Ein Unterfeld innerhalb einer generischen Liste (0450).
 *
 *  Bewusst eine ENGERE Auswahl an Arten als `FeldArt`: eine Liste in einer
 *  Liste, eine Tabelle in einer Liste oder eine Objektauswahl in einer Liste
 *  gibt es nicht — sie wären im Inspektor nicht mehr bedienbar. */
export type UnterFeldArt =
  | "text"
  | "einfachtext"
  | "textlang"
  | "richtext"
  | "bild"
  | "link"
  | "zahl"
  | "schalter"
  | "auswahl"
  | "symbol";

export type UnterFeld = {
  /** Schlüssel im Eintrag (nicht im `content` des Abschnitts). */
  key: string;
  art: UnterFeldArt;
  /** i18n-Schlüssel unter `website.felder`. */
  label: string;
  optionen?: Array<{ wert: string; label: string }>;
  standard?: string;
  min?: number;
  max?: number;
};

export type Feld = {
  /** Schlüssel im `content` des Abschnitts. */
  key: string;
  art: FeldArt;
  /** i18n-Schlüssel unter `website.felder`. */
  label: string;
  /** Nur bei art="auswahl": die erlaubten Werte + ihr i18n-Schlüssel. */
  optionen?: Array<{ wert: string; label: string }>;
  /** Bei art="auswahl": der Wert, der gilt, wenn nichts gewählt wurde.
   *  Bei art="schalter": `"true"`, wenn das Backend-Schema den Schalter
   *  standardmäßig AN führt — ohne diese Angabe zeigte die Oberfläche „aus"
   *  für einen Wert, der in Wahrheit „an" ist.
   *
   *  MUSS gesetzt sein, wenn das Backend an dieser Stelle ein Pflichtfeld hat.
   *  Vorher bot die Auswahl eine leere Option „Standard" an, die `null` schickte
   *  — und `null` in einem `str`-Feld ließ das Speichern der ganzen Seite mit
   *  400 scheitern. Der Wert hier ist KEIN erfundener Ersatz, sondern derselbe,
   *  den das Backend-Schema als Default führt. */
  standard?: string;
  /** Nur bei art="zahl": harte Grenzen (Wurzel 8 — kein unbegrenzter Bereich). */
  min?: number;
  max?: number;
  /** Nur bei art="liste": woraus ein Eintrag besteht (0450). */
  unterfelder?: UnterFeld[];
  /** Nur bei art="liste"/"tabelle": Höchstzahl der Einträge bzw. Zeilen.
   *
   *  MUSS zur Obergrenze des Backend-Schemas passen. Ein Client, der mehr
   *  zulässt, produziert ein 422 beim Speichern der GANZEN Seite — für den
   *  Kunden sieht das aus, als sei der Baukasten kaputt (genau der Fehler,
   *  der bei den Auswahl-Feldern schon einmal passiert ist). */
  maxEintraege?: number;
  /** Nur bei art="tabelle": Höchstzahl der Spalten je Zeile. */
  maxSpalten?: number;
  /** Das Feld erscheint NUR, wenn ein anderes einen dieser Werte trägt.
   *
   *  Nötig, weil manche Regler nur zu einer bestimmten Wahl gehören: „Beiträge
   *  je Zeile" hat in einer einspaltigen Liste keine Bedeutung, und ein Regler,
   *  der sichtbar ist und nichts bewirkt, ist eine Attrappe (Wurzel 4).
   *  Squarespace macht denselben Schnitt — „Columns" hängt dort nur an den
   *  beiden Raster-Layouts.
   *
   *  Der WERT bleibt gespeichert, wenn das Feld verschwindet: wer die Anordnung
   *  zurückstellt, findet seine Spaltenzahl wieder (Wurzel 1). Ausblenden ist
   *  also nicht Löschen. */
  nurWenn?: { key: string; werte: readonly string[] };
};

/** Ein Eintrag der Kategorie „Layout": ein CONTAINER, kein Baustein.
 *
 *  Container tragen keinen Inhalt — was sie ausmacht, steht in eigenen SPALTEN
 *  von `site_blocks` (`kind`, `parent_id`, `span`, 0472). Deshalb stehen sie
 *  nicht in `ABSCHNITTE`: ein Eintrag dort hat Felder, die der Inspektor
 *  zeichnet, und ein Container hätte keine.
 *
 *  Das Vorbild ist Framers Einfügemenü (Frame · Stack · Grid · Masonry) und
 *  Hostaways „Layout"-Kategorie. Aufgenommen ist nur, was der Renderer
 *  WIRKLICH zeichnet (`block-renderer.tsx`, `kinderRendern`): Abschnitte
 *  untereinander, Spalten nebeneinander mit `span` in Zwölfteln. Ein Eintrag
 *  für etwas, das er nicht zeichnet, wäre eine Attrappe (Wurzel 4). */
export type LayoutBaustein = {
  /** Kennung für die Oberfläche — KEIN `BlockType`. */
  id: string;
  /** Was in der DB entsteht. */
  kind: "section" | "column";
  /** Wie viele Spalten dieses Layout anlegt. 0 = nur den Abschnitt. */
  spalten: number;
  /** Breite je Spalte in Zwölfteln, in der Reihenfolge der Spalten.
   *
   *  `null` = gleichmäßig teilen (der Renderer lässt `flex` das machen). Eine
   *  Liste, weil „ein Drittel / zwei Drittel" zwei verschiedene Breiten sind. */
  breiten: readonly number[] | null;
  icon: string;
  /** i18n-Schlüssel unter `website.layout`. */
  label: string;
  hinweis: string;
};

/** Die Layout-Container des Katalogs. */
export const LAYOUT_BAUSTEINE: readonly LayoutBaustein[] = [
  {
    // Framers „Stack": ein Rahmen, Inhalt untereinander. Bei uns ein Abschnitt
    // mit EINER Spalte über die ganze Breite — genau das, was die automatische
    // Hülle (`_huelle_fuer_widget`) auch baut.
    //
    // Vorher stand hier `spalten: 0`, und das war eine Sackgasse: die DB
    // verbietet einen Baustein direkt in einer Section (`site_blocks_tiefe`),
    // Abwurfziele sind nur Spalten, und „Spalte hinzufügen" gab es nicht. Wer
    // dieses Layout wählte, bekam einen leeren gestrichelten Kasten, den man
    // weder füllen noch löschen konnte.
    id: "abschnitt",
    kind: "section",
    spalten: 1,
    breiten: [12],
    icon: "ph:rows",
    label: "abschnitt",
    hinweis: "abschnittHinweis",
  },
  {
    id: "zweiSpalten",
    kind: "section",
    spalten: 2,
    breiten: [6, 6],
    icon: "ph:columns",
    label: "zweiSpalten",
    hinweis: "zweiSpaltenHinweis",
  },
  {
    id: "dreiSpalten",
    kind: "section",
    spalten: 3,
    breiten: [4, 4, 4],
    icon: "ph:columns-plus-right",
    label: "dreiSpalten",
    hinweis: "dreiSpaltenHinweis",
  },
  {
    id: "vierSpalten",
    kind: "section",
    spalten: 4,
    breiten: [3, 3, 3, 3],
    icon: "ph:grid-four",
    label: "vierSpalten",
    hinweis: "vierSpaltenHinweis",
  },
  {
    // Die ungleichen Teilungen. Sie sind der eigentliche Grund für `span`:
    // gleiche Spalten könnte `flex` allein, „ein Drittel neben zwei Dritteln"
    // nicht.
    id: "einZweiDrittel",
    kind: "section",
    spalten: 2,
    breiten: [4, 8],
    icon: "ph:sidebar",
    label: "einZweiDrittel",
    hinweis: "einZweiDrittelHinweis",
  },
  {
    id: "zweiEinDrittel",
    kind: "section",
    spalten: 2,
    breiten: [8, 4],
    icon: "ph:sidebar-flip",
    label: "zweiEinDrittel",
    hinweis: "zweiEinDrittelHinweis",
  },
];

export type Abschnitt = {
  typ: BlockType;
  gruppe: Gruppe;
  icon: string;
  /** i18n-Schlüssel unter `website.abschnitte`. */
  label: string;
  /** i18n-Schlüssel für die Ein-Zeilen-Erklärung im Katalog. */
  hinweis: string;
  felder: Feld[];
  /** Zeigt an, dass dieser Abschnitt echte Buchungsdaten bringt — der Vorsprung
   *  gegenüber einem reinen Website-Baukasten. */
  buchung?: boolean;
};

/**
 * Zieht dieser Baustein seinen Inhalt aus den DATEN statt aus dem, was der
 * Kunde eintippt?
 *
 *  Die Arbeitsfläche färbt seine Pille danach VIOLETT statt blau (`docs/UI`,
 *  Foto 19.05.26). Der Unterschied ist keine Zierde: bei einem dynamischen
 *  Baustein — Objektliste, Bewertungen, Suchformular — gibt es keine
 *  Überschrift zum Anklicken und kein Bild zum Austauschen. Wer das nicht
 *  vorher sieht, klickt darauf, findet im Inspektor nur Filter und hält den
 *  Baukasten für kaputt.
 *
 *  Abgeleitet und nicht als drittes Flag am Katalog: `buchung` sagt schon genau
 *  das („dieser Abschnitt bringt echte Buchungsdaten"), und die Gruppe
 *  `buchung` sammelt dieselben. Ein eigenes `dynamisch: true` an sechzig
 *  Einträgen wäre eine zweite Wahrheit, die beim nächsten neuen Baustein an
 *  einer der beiden Stellen fehlt.
 */
export function istDynamisch(typ: BlockType): boolean {
  const meta = abschnittFuer(typ);
  if (!meta) return false;
  return Boolean(meta.buchung) || meta.gruppe === "buchung";
}

export const ABSCHNITTE: Abschnitt[] = [
  // --- Inhalt ---------------------------------------------------------------
  {
    typ: "hero",
    gruppe: "inhalt",
    icon: "ph:image-square",
    label: "hero",
    hinweis: "heroHinweis",
    felder: [
      { key: "eyebrow", art: "text", label: "eyebrow" },
      { key: "heading", art: "text", label: "heading" },
      { key: "subheading", art: "textlang", label: "subheading" },
      { key: "image_url", art: "bild", label: "bild" },
      { key: "cta_label", art: "text", label: "ctaLabel" },
      { key: "cta_href", art: "link", label: "ctaHref" },
      {
        key: "variant",
        art: "auswahl",
        label: "variante",
        // HeroContent.variant ist im Backend ein str mit Default "fullscreen".
        standard: "fullscreen",
        optionen: [
          { wert: "fullscreen", label: "heroVollbild" },
          { wert: "split", label: "heroGeteilt" },
          { wert: "centered", label: "heroZentriert" },
        ],
      },
    ],
  },
  {
    typ: "rich_text",
    gruppe: "inhalt",
    icon: "ph:text-aa",
    label: "richText",
    hinweis: "richTextHinweis",
    felder: [
      { key: "html", art: "richtext", label: "text" },
      {
        key: "align",
        art: "auswahl",
        label: "ausrichtung",
        // RichTextContent.align: str = "left"
        standard: "left",
        optionen: [
          { wert: "left", label: "linksbuendig" },
          { wert: "center", label: "zentriert" },
        ],
      },
    ],
  },
  {
    typ: "button",
    gruppe: "inhalt",
    icon: "ph:cursor-click",
    label: "button",
    hinweis: "buttonHinweis",
    felder: [
      { key: "label", art: "text", label: "beschriftung" },
      { key: "href", art: "link", label: "ziel" },
      {
        key: "variant",
        art: "auswahl",
        label: "variante",
        // ButtonContent.variant: str = "primary"
        standard: "primary",
        optionen: [
          { wert: "primary", label: "buttonPrimaer" },
          { wert: "secondary", label: "buttonSekundaer" },
        ],
      },
    ],
  },
  {
    typ: "spacer",
    gruppe: "inhalt",
    icon: "ph:arrows-out-line-vertical",
    label: "spacer",
    hinweis: "spacerHinweis",
    felder: [
      {
        key: "size",
        art: "auswahl",
        label: "hoehe",
        // SpacerContent.size: str = "md"
        standard: "md",
        optionen: [
          { wert: "sm", label: "abstandKlein" },
          { wert: "md", label: "abstandMittel" },
          { wert: "lg", label: "abstandGross" },
          { wert: "xl", label: "abstandSehrGross" },
        ],
      },
    ],
  },

  // --- Buchung (unser Vorsprung gegenüber reinen Website-Baukästen) ---------
  {
    typ: "search",
    gruppe: "buchung",
    icon: "ph:magnifying-glass",
    label: "search",
    hinweis: "searchHinweis",
    buchung: true,
    felder: [
      { key: "placeholder", art: "text", label: "platzhalter" },
      { key: "show_dates", art: "schalter", label: "datumZeigen" },
      { key: "show_guests", art: "schalter", label: "gaesteZeigen" },
    ],
  },
  {
    typ: "properties_grid",
    gruppe: "buchung",
    icon: "ph:grid-four",
    label: "propertiesGrid",
    hinweis: "propertiesGridHinweis",
    buchung: true,
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "q", art: "einfachtext", label: "suchbegriff" },
      { key: "guests", art: "zahl", label: "mindestGaeste", min: 1, max: 30 },
      { key: "limit", art: "zahl", label: "anzahl", min: 1, max: 48 },
    ],
  },
  {
    typ: "featured_properties",
    gruppe: "buchung",
    icon: "ph:star-four",
    label: "featuredProperties",
    hinweis: "featuredPropertiesHinweis",
    buchung: true,
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "property_ids", art: "objekte", label: "objekte" },
    ],
  },
  {
    typ: "reviews",
    gruppe: "buchung",
    icon: "ph:star",
    label: "reviews",
    hinweis: "reviewsHinweis",
    buchung: true,
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      // Obergrenze wie im Backend-Schema (ReviewsContent.limit: 1–24).
      { key: "limit", art: "zahl", label: "anzahl", min: 1, max: 24 },
      { key: "show_categories", art: "schalter", label: "kategorienZeigen" },
    ],
  },
  {
    typ: "features",
    gruppe: "inhalt",
    icon: "ph:squares-four",
    label: "features",
    hinweis: "featuresHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "items", art: "merkmale", label: "merkmale" },
      // 2–4 wie im Backend-Schema: bei fünf sind die Texte auf einem Laptop
      // unlesbar schmal, bei einer wäre es eine Liste (dafür gibt es Text).
      { key: "columns", art: "zahl", label: "spalten", min: 2, max: 4 },
    ],
  },
  {
    typ: "testimonials",
    gruppe: "inhalt",
    icon: "ph:quotes",
    label: "testimonials",
    hinweis: "testimonialsHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "items", art: "stimmen", label: "stimmen" },
    ],
  },
  {
    typ: "faq",
    gruppe: "inhalt",
    icon: "ph:question",
    label: "faq",
    hinweis: "faqHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "items", art: "fragen", label: "fragen" },
    ],
  },
  {
    // „Alle Beiträge" und „Neueste Beiträge" sind bei Hostaway zwei
    // Katalogeinträge, die nach dem Einfügen DASSELBE Widget sind. Bei uns ist
    // es ein Eintrag mit Einstellungen: der Unterschied zwischen den beiden ist
    // genau eine Zahl (`anzahl`) und ein Schalter (`navigation`), und zwei
    // Kacheln, die dasselbe erzeugen, sind eine Erklärung, die man beim ersten
    // Klick wieder vergisst.
    typ: "posts",
    gruppe: "inhalt",
    icon: "ph:newspaper",
    label: "posts",
    hinweis: "postsHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      // WIE die Beiträge angeordnet sind — die erste Frage, deshalb das erste
      // Feld. Vier Arten, abgeleitet aus dem Marktstandard (Squarespace 7.1
      // führt fünf, Hostaway nennt sie „Post Layouts"; recherchiert
      // 27.08.2026): genau die, die der Renderer zeichnet.
      {
        key: "layout",
        art: "auswahl",
        label: "beitragsLayout",
        // `grid` ist das bisherige Aussehen — ein neues Feld darf eine
        // bestehende Kundenseite nicht umbauen (Wurzel 1).
        standard: "grid",
        optionen: [
          { wert: "grid", label: "beitragsLayoutRaster" },
          { wert: "masonry", label: "beitragsLayoutMosaik" },
          { wert: "list", label: "beitragsLayoutListe" },
          { wert: "side", label: "beitragsLayoutNebeneinander" },
        ],
      },
      // 1–9 wie im Backend-Schema: weniger ist keine Liste, mehr gehört auf
      // die Blog-Seite.
      { key: "limit", art: "zahl", label: "anzahl", min: 1, max: 9 },
      // Schlagwörter als KOMMALISTE und nicht als Mehrfachauswahl: der
      // Inspektor kennt genau die Feldarten oben, und eine Mehrfachauswahl ist
      // keine davon. Sie nachzurüsten ist die richtige Lösung — bis dahin ist
      // ein Textfeld ehrlicher als eine Auswahl, die beim nächsten Öffnen leer
      // zurückkommt.
      { key: "tags", art: "einfachtext", label: "beitragsSchlagworte" },
      { key: "show_thumbnails", art: "schalter", label: "beitragsBilder" },
      { key: "show_author_date", art: "schalter", label: "beitragsAutorDatum" },
      { key: "show_blog_name", art: "schalter", label: "beitragsBlogname" },
      { key: "single_line_title", art: "schalter", label: "beitragsEinzeilig" },
      { key: "show_read_more", art: "schalter", label: "beitragsWeiterlesen" },
      { key: "read_more", art: "text", label: "beitragsWeiterlesenText" },
      // Nur Desktop/Tablet — auf dem Telefon steht immer einer je Zeile.
      // Und nur bei den RASTER-Arten: eine einspaltige Liste hat keine
      // Spaltenzahl (derselbe Schnitt wie bei Squarespace).
      {
        key: "per_row",
        art: "zahl",
        label: "beitragsJeZeile",
        min: 1,
        max: 4,
        nurWenn: { key: "layout", werte: ["grid", "masonry"] },
      },
      // 0 = keinen Anriss zeigen.
      { key: "teaser_lines", art: "zahl", label: "beitragsZeilen", min: 0, max: 8 },
      {
        key: "gap",
        art: "auswahl",
        label: "beitragsAbstand",
        standard: "md",
        optionen: [
          { wert: "sm", label: "abstandKlein" },
          { wert: "md", label: "abstandMittel" },
          { wert: "lg", label: "abstandGross" },
        ],
      },
      {
        key: "navigation",
        art: "auswahl",
        label: "beitragsNavigation",
        // `none` ist der Backend-Default UND das bisherige Verhalten: ein neues
        // Feld darf bestehende Kundenseiten nicht verändern (Wurzel 1).
        standard: "none",
        optionen: [
          { wert: "none", label: "navigationNichts" },
          { wert: "button", label: "navigationKnopf" },
          { wert: "pages", label: "navigationSeitenzahlen" },
        ],
      },
    ],
  },
  {
    // Die Beitragssuche (0458). Eigener Typ neben „Suche": die sucht OBJEKTE
    // (Verfügbarkeit und Preis), diese sucht in den TITELN der Beiträge. Ein
    // Abschnitt mit zwei grundverschiedenen Betriebsarten sind zwei Abschnitte
    // in einem.
    typ: "search_posts",
    gruppe: "inhalt",
    icon: "ph:magnifying-glass",
    label: "searchPosts",
    hinweis: "searchPostsHinweis",
    felder: [{ key: "placeholder", art: "text", label: "platzhalter" }],
  },
  // --- Business-Widgets (0452) ---------------------------------------------
  // Sie waren im Backend und im Renderer da, aber nie im Katalog — damit ließen
  // sie sich nirgends anlegen. Toter Code auf beiden Seiten.
  {
    typ: "business_hours",
    gruppe: "inhalt",
    icon: "ph:clock",
    label: "businessHours",
    hinweis: "businessHoursHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "days", art: "liste", label: "wochentage" },
    ],
  },
  {
    typ: "click_to_call",
    gruppe: "inhalt",
    icon: "ph:phone",
    label: "clickToCall",
    hinweis: "clickToCallHinweis",
    felder: [
      { key: "label", art: "text", label: "beschriftung" },
      { key: "phone", art: "einfachtext", label: "rufnummer" },
    ],
  },
  {
    typ: "click_to_email",
    gruppe: "inhalt",
    icon: "ph:envelope",
    label: "clickToEmail",
    hinweis: "clickToEmailHinweis",
    felder: [
      { key: "label", art: "text", label: "beschriftung" },
      { key: "email", art: "einfachtext", label: "email" },
    ],
  },
  {
    typ: "multi_location",
    gruppe: "inhalt",
    icon: "ph:map-trifold",
    label: "multiLocation",
    hinweis: "multiLocationHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "items", art: "liste", label: "standorte" },
    ],
  },
  // --- Objektseite / Buchungsstrecke (0468) --------------------------------
  // Sie stehen in der Gruppe „buchung", weil sie genau dorthin gehören: sie
  // sind der Weg vom Ansehen zum Buchen. Ihr Inhalt kommt aus dem OBJEKT —
  // einstellbar ist hier nur die Darstellung.
  {
    typ: "property_book_form",
    gruppe: "buchung",
    icon: "ph:calendar-check",
    label: "propertyBookForm",
    hinweis: "propertyBookFormHinweis",
    felder: [
      { key: "intro", art: "textlang", label: "einleitung" },
      { key: "book_label", art: "text", label: "buchenBeschriftung" },
      { key: "inquiry_label", art: "text", label: "anfrageBeschriftung" },
      { key: "show_book", art: "schalter", label: "buchenZeigen" },
      { key: "show_inquiry", art: "schalter", label: "anfrageZeigen" },
      { key: "show_price", art: "schalter", label: "preisZeigen" },
      // Leer = das Objekt der aktuellen Seite. Nur außerhalb der Objektseite
      // muss hier eines stehen.
      { key: "property_id", art: "objekte", label: "objektWahl" },
    ],
  },
  {
    typ: "property_gallery",
    gruppe: "buchung",
    icon: "ph:images",
    label: "propertyGallery",
    hinweis: "propertyGalleryHinweis",
    felder: [
      { key: "max_images", art: "zahl", label: "maxBilder" },
      { key: "layout", art: "auswahl", label: "anordnung" },
      { key: "lightbox", art: "schalter", label: "lightbox" },
    ],
  },
  {
    typ: "property_description",
    gruppe: "buchung",
    icon: "ph:text-align-left",
    label: "propertyDescription",
    hinweis: "propertyDescriptionHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "truncate_at", art: "zahl", label: "kuerzenAb" },
    ],
  },
  {
    typ: "property_amenities",
    gruppe: "buchung",
    icon: "ph:list-checks",
    label: "propertyAmenities",
    hinweis: "propertyAmenitiesHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "visible_count", art: "zahl", label: "sofortSichtbar" },
      { key: "columns", art: "zahl", label: "spalten" },
    ],
  },
  {
    typ: "property_map",
    gruppe: "buchung",
    icon: "ph:map-pin",
    label: "propertyMap",
    hinweis: "propertyMapHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "zoom", art: "zahl", label: "zoom" },
      { key: "exact", art: "schalter", label: "genauerOrt" },
      { key: "height", art: "zahl", label: "hoehe" },
    ],
  },
  // --- Buchungsstrecke: Buchung und Bestätigung (0474) ---------------------
  // Bis 0474 waren Checkout und Bestätigung fest programmierte Renderer-Routen
  // ohne Bausteine. Sie standen in der Seitenliste, aber ein Klick öffnete nur
  // die SEO-Felder — dieselbe Sackgasse, die 0468 für die Objektseite behoben
  // hat.
  //
  // Was hier einstellbar ist, ist Text und Anordnung. NICHT einstellbar:
  // welche Zahlungsarten erscheinen (das entscheidet das Stripe-Konto des
  // Betriebs), welcher Betrag fällig ist (das rechnet der Preis-Resolver) und
  // was das Zahlungsergebnis war (das sagt Stripe). Ein Feld dafür wäre eine
  // zweite Wahrheit über Geld.
  {
    typ: "checkout_form",
    gruppe: "buchung",
    icon: "ph:credit-card",
    label: "checkoutForm",
    hinweis: "checkoutFormHinweis",
    buchung: true,
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "intro", art: "textlang", label: "einleitung" },
      { key: "submit_label", art: "text", label: "knopfBeschriftung" },
      { key: "trust_note", art: "textlang", label: "vertrauensHinweis" },
      { key: "steps", art: "auswahl", label: "stufen" },
      { key: "show_step_labels", art: "schalter", label: "stufenZeigen" },
    ],
  },
  {
    typ: "checkout_summary",
    gruppe: "buchung",
    icon: "ph:receipt",
    label: "checkoutSummary",
    hinweis: "checkoutSummaryHinweis",
    buchung: true,
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "position", art: "auswahl", label: "position" },
      { key: "show_photo", art: "schalter", label: "fotoZeigen" },
      { key: "show_breakdown", art: "schalter", label: "aufstellungZeigen" },
      {
        key: "show_cancellation",
        art: "schalter",
        label: "stornoZeigen",
      },
    ],
  },
  {
    typ: "checkout_result",
    gruppe: "buchung",
    icon: "ph:seal-check",
    label: "checkoutResult",
    hinweis: "checkoutResultHinweis",
    buchung: true,
    felder: [
      { key: "success_headline", art: "text", label: "erfolgUeberschrift" },
      { key: "success_text", art: "textlang", label: "erfolgText" },
      { key: "pending_headline", art: "text", label: "offenUeberschrift" },
      { key: "pending_text", art: "textlang", label: "offenText" },
      { key: "failed_headline", art: "text", label: "fehlerUeberschrift" },
      { key: "failed_text", art: "textlang", label: "fehlerText" },
      {
        key: "show_booking_number",
        art: "schalter",
        label: "nummerZeigen",
      },
      { key: "show_portal_link", art: "schalter", label: "portalLinkZeigen" },
    ],
  },
  // Die vollständige Beitragsübersicht. Sie steht in der Gruppe „inhalt" und
  // nicht bei „buchung": der Blog ist ein eigener Bereich mit eigenem CMS und
  // gehört nicht zur Buchungsstrecke.
  {
    typ: "post_list",
    gruppe: "inhalt",
    icon: "ph:newspaper",
    label: "postList",
    hinweis: "postListHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "per_page", art: "zahl", label: "proSeite" },
      { key: "columns", art: "zahl", label: "spalten" },
      { key: "show_cover", art: "schalter", label: "titelbildZeigen" },
      { key: "show_excerpt", art: "schalter", label: "anrissZeigen" },
      { key: "show_date", art: "schalter", label: "datumZeigen" },
      { key: "show_author", art: "schalter", label: "autorZeigen" },
      { key: "show_tags", art: "schalter", label: "schlagwoerterZeigen" },
    ],
  },
  {
    typ: "form",
    gruppe: "buchung",
    icon: "ph:list-checks",
    label: "form",
    hinweis: "formHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "intro", art: "textlang", label: "einleitung" },
      // Die Seiten stehen VOR den Feldern: erst legt man fest, wie viele
      // Schritte das Formular hat, dann teilt man die Felder darauf auf. In
      // der umgekehrten Reihenfolge stünde an jedem Feld eine Seitenauswahl
      // mit genau einem Eintrag.
      { key: "seiten", art: "formularseiten", label: "formularSeiten" },
      { key: "fields", art: "formfelder", label: "formularfelder" },
      { key: "submit_label", art: "text", label: "knopfText" },
      { key: "success_text", art: "textlang", label: "danketext" },
      // Rückfalltext bei einem Fehlschlag OHNE eigene Server-Meldung
      // (Netzfehler, 500). Eine konkrete Meldung des Servers — z. B. „Bitte
      // stimmen Sie der Datenverarbeitung zu" — hat immer Vorrang; dieser
      // Text greift nur, wenn der Server keine eigene Erklärung mitschickt.
      { key: "error_text", art: "textlang", label: "fehlertext" },
      // --- Nach dem Absenden (0444/0445) ---------------------------------
      // Ist ein Ziel gesetzt, entfällt die Danke-Meldung darüber: zwei
      // Bestätigungen hintereinander sind eine zu viel.
      { key: "weiterleitung", art: "link", label: "weiterleitungNachSenden" },
      // Standardmäßig AN, wie im Backend-Schema (`FormContent.bestaetigung`)
      // und wie bei Hostaway: ein Gast, der abschickt und nichts hört, schickt
      // noch einmal — oder ruft an.
      {
        key: "bestaetigung",
        art: "schalter",
        label: "bestaetigungAnAbsender",
        standard: "true",
      },
      { key: "bestaetigung_text", art: "textlang", label: "bestaetigungText" },
      // Einsprachig: eine Adresse wird nicht übersetzt. Der Versand läuft über
      // die SSRF-geprüfte Kette im Backend (`formular_nachlauf`) — IP prüfen,
      // auf die geprüfte IP pinnen, interne Netze blocken.
      { key: "webhook_url", art: "einfachtext", label: "webhookAdresse" },
      // Einsprachig: eine E-Mail-Adresse wird nicht übersetzt. Leer = die
      // Adresse aus dem Firmenprofil.
      { key: "recipient", art: "einfachtext", label: "empfaenger" },
      // Nur intern, für die Antwortenliste — nicht gast-sichtbar.
      { key: "form_name", art: "einfachtext", label: "formularName" },
    ],
  },
  {
    typ: "map",
    gruppe: "buchung",
    icon: "ph:map-pin",
    label: "map",
    hinweis: "mapHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      // Einsprachig: eine Anschrift wird nicht übersetzt. Leer = die Anschrift
      // aus dem Firmenprofil (der Renderer setzt sie ein).
      { key: "address", art: "einfachtext", label: "adresse" },
      // Grenzen wie bei Google: 1 = Welt, 20 = Gebäude. Darüber ist die Karte
      // leer.
      { key: "zoom", art: "zahl", label: "zoom", min: 1, max: 20 },
      { key: "height", art: "zahl", label: "hoehe", min: 200, max: 800 },
    ],
  },
  {
    typ: "contact",
    gruppe: "buchung",
    icon: "ph:envelope",
    label: "contact",
    hinweis: "contactHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "email", art: "einfachtext", label: "email" },
      { key: "phone", art: "einfachtext", label: "telefon" },
      { key: "address", art: "textlang", label: "adresse" },
      { key: "show_form", art: "schalter", label: "formularZeigen" },
    ],
  },

  // --- Medien ---------------------------------------------------------------
  {
    typ: "image",
    gruppe: "medien",
    icon: "ph:image",
    label: "image",
    hinweis: "imageHinweis",
    felder: [
      { key: "url", art: "bild", label: "bild" },
      { key: "alt", art: "text", label: "bildBeschreibung" },
      { key: "caption", art: "text", label: "bildUnterschrift" },
    ],
  },

  // --- 0450: Basis-Widgets ---------------------------------------------------
  // Reihenfolge im Katalog folgt der Gruppe, nicht der Migrationsnummer: der
  // Kunde sucht nach „was tut das", nicht nach „wann kam das".
  {
    typ: "accordion",
    gruppe: "inhalt",
    icon: "ph:rows",
    label: "accordion",
    hinweis: "accordionHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "items",
        art: "liste",
        label: "klappen",
        // MAX_ACCORDION_ITEMS im Backend.
        maxEintraege: 30,
        unterfelder: [
          { key: "title", art: "text", label: "titel" },
          { key: "text", art: "richtext", label: "text" },
        ],
      },
      { key: "single_open", art: "schalter", label: "nurEinerOffen" },
      { key: "first_open", art: "schalter", label: "ersterOffen" },
    ],
  },
  {
    typ: "tabs",
    gruppe: "inhalt",
    icon: "ph:squares-four",
    label: "tabs",
    hinweis: "tabsHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "items",
        art: "liste",
        label: "reiter",
        // MAX_TABS im Backend.
        maxEintraege: 12,
        unterfelder: [
          { key: "label", art: "text", label: "reiterBeschriftung" },
          { key: "title", art: "text", label: "ueberschrift" },
          { key: "text", art: "richtext", label: "text" },
          { key: "image_url", art: "bild", label: "bild" },
        ],
      },
    ],
  },
  {
    typ: "countdown",
    gruppe: "inhalt",
    icon: "ph:timer",
    label: "countdown",
    hinweis: "countdownHinweis",
    felder: [
      { key: "title", art: "text", label: "ueberschrift" },
      { key: "target", art: "datumzeit", label: "zielzeitpunkt" },
      { key: "expired_text", art: "text", label: "ablaufText" },
      {
        key: "on_expired",
        art: "auswahl",
        label: "nachAblauf",
        // CountdownContent.on_expired: str = "message"
        standard: "message",
        optionen: [
          { wert: "message", label: "nachAblaufMeldung" },
          { wert: "counter", label: "nachAblaufZaehler" },
        ],
      },
    ],
  },
  {
    typ: "table",
    gruppe: "inhalt",
    icon: "ph:table",
    label: "table",
    hinweis: "tableHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "header",
        art: "liste",
        label: "spaltenkoepfe",
        // MAX_TABELLEN_SPALTEN im Backend.
        maxEintraege: 30,
        unterfelder: [{ key: "title", art: "text", label: "titel" }],
      },
      {
        key: "rows",
        art: "tabelle",
        label: "tabellenzeilen",
        // MAX_TABELLEN_ZEILEN / MAX_TABELLEN_SPALTEN im Backend.
        maxEintraege: 150,
        maxSpalten: 30,
      },
      {
        key: "highlight_first_column",
        art: "schalter",
        label: "ersteSpalteHervorheben",
      },
    ],
  },
  {
    typ: "list",
    gruppe: "inhalt",
    icon: "ph:list-bullets",
    label: "list",
    hinweis: "listHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "items",
        art: "liste",
        label: "listenEintraege",
        // MAX_LISTEN_ITEMS im Backend.
        maxEintraege: 30,
        unterfelder: [
          { key: "image_url", art: "bild", label: "bild" },
          { key: "title", art: "text", label: "titel" },
          { key: "text", art: "textlang", label: "text" },
          { key: "link_href", art: "link", label: "ziel" },
          { key: "link_label", art: "text", label: "linkText" },
        ],
      },
      {
        key: "layout",
        art: "auswahl",
        label: "layout",
        // ListContent.layout: str = "stacked"
        standard: "stacked",
        optionen: [
          { wert: "stacked", label: "layoutGestapelt" },
          { wert: "grid", label: "layoutRaster" },
          { wert: "numbered", label: "layoutNummeriert" },
        ],
      },
    ],
  },
  {
    typ: "copyright",
    gruppe: "sonstiges",
    icon: "ph:copyright",
    label: "copyright",
    hinweis: "copyrightHinweis",
    felder: [
      { key: "text", art: "text", label: "text" },
      { key: "reverse", art: "schalter", label: "jahrRechts" },
    ],
  },
  {
    typ: "breadcrumbs",
    gruppe: "sonstiges",
    icon: "ph:path",
    label: "breadcrumbs",
    hinweis: "breadcrumbsHinweis",
    felder: [
      { key: "show_home", art: "schalter", label: "startZeigen" },
      { key: "show_current", art: "schalter", label: "aktuelleZeigen" },
      {
        key: "hide_without_parent",
        art: "schalter",
        label: "ohneElternVerbergen",
      },
    ],
  },

  {
    typ: "file",
    gruppe: "medien",
    icon: "ph:file-arrow-down",
    label: "file",
    hinweis: "fileHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "items",
        art: "liste",
        label: "dateien",
        // MAX_DATEIEN im Backend.
        maxEintraege: 10,
        unterfelder: [
          { key: "url", art: "link", label: "dateiAdresse" },
          { key: "label", art: "text", label: "beschriftung" },
        ],
      },
      { key: "noindex", art: "schalter", label: "nichtIndexieren" },
    ],
  },
  {
    typ: "gallery",
    gruppe: "medien",
    icon: "ph:images",
    label: "gallery",
    hinweis: "galleryHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "images", art: "bilder", label: "bilder" },
      // 2–5 wie im Backend-Schema. Der Default 3 ist dasselbe Raster wie vor
      // 0451 — ein neues Feld darf bestehende Kundenseiten nicht umbauen.
      { key: "columns", art: "zahl", label: "spalten", min: 2, max: 5 },
      { key: "lightbox", art: "schalter", label: "lightbox" },
      { key: "show_captions", art: "schalter", label: "beschriftungenZeigen" },
    ],
  },

  // --- 0451: Medien-Widgets -------------------------------------------------
  {
    typ: "media_slider",
    gruppe: "medien",
    icon: "ph:slideshow",
    label: "mediaSlider",
    hinweis: "mediaSliderHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "slides",
        art: "liste",
        label: "folien",
        // MAX_SLIDER_FOLIEN im Backend — Hostaways Zahl.
        maxEintraege: 25,
        unterfelder: [
          { key: "image_url", art: "bild", label: "bild" },
          { key: "title", art: "text", label: "titel" },
          { key: "text", art: "textlang", label: "text" },
          { key: "cta_label", art: "text", label: "ctaLabel" },
          { key: "cta_href", art: "link", label: "ctaHref" },
        ],
      },
      // 0 = aus. Das ist der Default und keine Zurückhaltung: ein Slider, der
      // weiterläuft, während jemand liest, ist die häufigste Beschwerde über
      // Slider überhaupt.
      { key: "autoplay_seconds", art: "zahl", label: "autoplaySekunden", min: 0, max: 20 },
      {
        key: "transition",
        art: "auswahl",
        label: "uebergang",
        standard: "slide",
        optionen: [
          { wert: "slide", label: "uebergangSchieben" },
          { wert: "fade", label: "uebergangBlenden" },
        ],
      },
      { key: "pause_on_hover", art: "schalter", label: "pauseBeiZeiger" },
    ],
  },
  {
    typ: "video",
    gruppe: "medien",
    icon: "ph:play-circle",
    label: "video",
    hinweis: "videoHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      // Einsprachig: eine Video-Adresse wird nicht übersetzt. Das Backend löst
      // daraus Anbieter und Kennung — eine fremde Adresse wird abgelehnt.
      { key: "url", art: "einfachtext", label: "videoAdresse" },
      { key: "schema_name", art: "text", label: "videoName" },
      { key: "schema_description", art: "textlang", label: "videoBeschreibung" },
      { key: "schema_upload_date", art: "einfachtext", label: "videoDatum" },
    ],
  },
  {
    typ: "audio",
    gruppe: "medien",
    icon: "ph:speaker-high",
    label: "audio",
    hinweis: "audioHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "url", art: "einfachtext", label: "audioAdresse" },
      { key: "dark", art: "schalter", label: "dunkleFassung" },
    ],
  },
  {
    typ: "before_after",
    gruppe: "medien",
    icon: "ph:columns",
    label: "beforeAfter",
    hinweis: "beforeAfterHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "before_url", art: "bild", label: "bildVorher" },
      { key: "before_label", art: "text", label: "beschriftungVorher" },
      { key: "after_url", art: "bild", label: "bildNachher" },
      { key: "after_label", art: "text", label: "beschriftungNachher" },
    ],
  },
  {
    typ: "shape",
    gruppe: "sonstiges",
    icon: "ph:diamond",
    label: "shape",
    hinweis: "shapeHinweis",
    felder: [
      {
        key: "shape",
        art: "auswahl",
        label: "form",
        // SHAPE_FORMEN im Backend.
        standard: "circle",
        optionen: [
          { wert: "circle", label: "formKreis" },
          { wert: "rounded", label: "formAbgerundet" },
          { wert: "square", label: "formQuadrat" },
          { wert: "diamond", label: "formRaute" },
          { wert: "hexagon", label: "formSechseck" },
          { wert: "blob", label: "formTropfen" },
          { wert: "flag", label: "formWimpel" },
        ],
      },
      { key: "title", art: "text", label: "titel" },
      { key: "text", art: "richtext", label: "text" },
      { key: "href", art: "link", label: "ziel" },
      { key: "image_url", art: "bild", label: "bild" },
      {
        key: "align",
        art: "auswahl",
        label: "ausrichtung",
        standard: "center",
        optionen: [
          { wert: "left", label: "linksbuendig" },
          { wert: "center", label: "zentriert" },
          { wert: "right", label: "rechtsbuendig" },
        ],
      },
    ],
  },

  // --- 0471: Social-/Sonstiges-Widgets ---------------------------------------
  {
    // Trägt KEINE eigene Link-Liste: die Adressen stehen bereits im
    // Firmenprofil (dieselbe Quelle wie die Fußzeile jeder Website) — hier
    // wird nur die Darstellung gewählt.
    typ: "social_icons",
    gruppe: "sonstiges",
    icon: "ph:share-network",
    label: "socialIcons",
    hinweis: "socialIconsHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      {
        key: "size",
        art: "auswahl",
        label: "groesse",
        standard: "md",
        optionen: [
          { wert: "sm", label: "abstandKlein" },
          { wert: "md", label: "abstandMittel" },
          { wert: "lg", label: "abstandGross" },
        ],
      },
      {
        key: "style",
        art: "auswahl",
        label: "stil",
        standard: "filled",
        optionen: [
          { wert: "filled", label: "stilGefuellt" },
          { wert: "outline", label: "stilUmriss" },
          { wert: "minimal", label: "stilMinimal" },
        ],
      },
      {
        key: "alignment",
        art: "auswahl",
        label: "ausrichtung",
        standard: "center",
        optionen: [
          { wert: "left", label: "linksbuendig" },
          { wert: "center", label: "zentriert" },
          { wert: "right", label: "rechtsbuendig" },
        ],
      },
    ],
  },
  {
    typ: "share_button",
    gruppe: "sonstiges",
    icon: "ph:share-fat",
    label: "shareButton",
    hinweis: "shareButtonHinweis",
    felder: [
      { key: "label", art: "text", label: "beschriftung" },
      {
        key: "style",
        art: "auswahl",
        label: "stil",
        standard: "icon_label",
        optionen: [
          { wert: "icon", label: "stilNurSymbol" },
          { wert: "icon_label", label: "stilSymbolUndText" },
        ],
      },
      { key: "facebook", art: "schalter", label: "netzwerkFacebook", standard: "true" },
      { key: "x", art: "schalter", label: "netzwerkX", standard: "true" },
      { key: "linkedin", art: "schalter", label: "netzwerkLinkedin", standard: "true" },
      { key: "whatsapp", art: "schalter", label: "netzwerkWhatsapp", standard: "true" },
      { key: "email", art: "schalter", label: "netzwerkEmail", standard: "true" },
      { key: "copy_link", art: "schalter", label: "netzwerkLinkKopieren", standard: "true" },
    ],
  },
  {
    typ: "whatsapp_chat",
    gruppe: "sonstiges",
    icon: "ph:whatsapp-logo",
    label: "whatsappChat",
    hinweis: "whatsappChatHinweis",
    felder: [
      { key: "phone", art: "einfachtext", label: "whatsappNummer" },
      { key: "message", art: "text", label: "whatsappNachricht" },
      { key: "label", art: "text", label: "beschriftung" },
      {
        key: "position",
        art: "auswahl",
        label: "position",
        standard: "right",
        optionen: [
          { wert: "left", label: "positionLinks" },
          { wert: "right", label: "positionRechts" },
        ],
      },
    ],
  },
  {
    typ: "rss_feed",
    gruppe: "sonstiges",
    icon: "ph:rss",
    label: "rssFeed",
    hinweis: "rssFeedHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "feed_url", art: "einfachtext", label: "feedAdresse" },
      // MAX_RSS_ITEMS im Backend.
      { key: "max_items", art: "zahl", label: "anzahl", min: 1, max: 12 },
      { key: "show_date", art: "schalter", label: "datumZeigen", standard: "true" },
      { key: "show_excerpt", art: "schalter", label: "anrissZeigen", standard: "true" },
      { key: "open_new_tab", art: "schalter", label: "neuesFensterOeffnen", standard: "true" },
    ],
  },
  {
    typ: "facebook_feed",
    gruppe: "sonstiges",
    icon: "ph:facebook-logo",
    label: "facebookFeed",
    hinweis: "facebookFeedHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      { key: "page_url", art: "einfachtext", label: "facebookSeitenadresse" },
      {
        key: "tabs",
        art: "auswahl",
        label: "facebookReiter",
        standard: "timeline",
        optionen: [
          { wert: "timeline", label: "facebookReiterChronik" },
          { wert: "events", label: "facebookReiterEvents" },
          { wert: "messages", label: "facebookReiterNachrichten" },
        ],
      },
      { key: "height", art: "zahl", label: "hoehe", min: 200, max: 1200 },
      { key: "hide_cover", art: "schalter", label: "titelbildVerbergen" },
      { key: "small_header", art: "schalter", label: "kopfKompakt" },
    ],
  },
  {
    typ: "html_widget",
    gruppe: "sonstiges",
    icon: "ph:code",
    label: "htmlWidget",
    hinweis: "htmlWidgetHinweis",
    felder: [{ key: "html", art: "textlang", label: "htmlQuelltext" }],
  },
];

const NACH_TYP = new Map(ABSCHNITTE.map((a) => [a.typ, a]));

/** Katalog-Eintrag zu einem Typ. null, wenn der Typ nicht (mehr) im Katalog
 *  steht — dann zeigt die Liste den Abschnitt als unbekannt an, statt sich
 *  wegzuwerfen oder abzustürzen. */
export function abschnittFuer(typ: BlockType): Abschnitt | null {
  return NACH_TYP.get(typ) ?? null;
}

/** Wie viele Abschnitte eine Seite höchstens haben darf.
 *  Muss zur Backend-Obergrenze passen (`BlocksReplaceRequest.items`, max 60):
 *  ein Client, der mehr zulässt, produziert ein 422 beim Speichern. */
export const MAX_ABSCHNITTE = 60;
