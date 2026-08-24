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

/** Gruppen des „Abschnitt hinzufügen"-Dialogs. Reihenfolge = Anzeigeordnung. */
export const GRUPPEN = ["inhalt", "buchung", "medien", "sonstiges"] as const;
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
  // Liste von Formularfeldern: Name, Art, Beschriftung, Pflicht (0436).
  | "formfelder";

export type Feld = {
  /** Schlüssel im `content` des Abschnitts. */
  key: string;
  art: FeldArt;
  /** i18n-Schlüssel unter `website.felder`. */
  label: string;
  /** Nur bei art="auswahl": die erlaubten Werte + ihr i18n-Schlüssel. */
  optionen?: Array<{ wert: string; label: string }>;
  /** Nur bei art="auswahl": der Wert, der gilt, wenn nichts gewählt wurde.
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
};

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
    typ: "posts",
    gruppe: "inhalt",
    icon: "ph:newspaper",
    label: "posts",
    hinweis: "postsHinweis",
    felder: [
      { key: "headline", art: "text", label: "ueberschrift" },
      // 1–9 wie im Backend-Schema: weniger ist keine Liste, mehr gehört auf
      // die Blog-Seite.
      { key: "limit", art: "zahl", label: "anzahl", min: 1, max: 9 },
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
      { key: "fields", art: "formfelder", label: "formularfelder" },
      { key: "submit_label", art: "text", label: "knopfText" },
      { key: "success_text", art: "textlang", label: "danketext" },
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
  {
    typ: "gallery",
    gruppe: "medien",
    icon: "ph:images",
    label: "gallery",
    hinweis: "galleryHinweis",
    felder: [{ key: "images", art: "bilder", label: "bilder" }],
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
