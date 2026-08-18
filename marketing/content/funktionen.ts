// Die neun Funktions-Unterseiten — welche es gibt, worauf sie zeigen.
//
// WARUM ES SIE GIBT (Referenz-Recherche 18.08.2026):
// Lodgify führt zu JEDER Funktion eine eigene Seite (`/ferienwohnung-channel-
// manager/`, `/dynamic-pricing/`, `/aufgabenmanagement/`, `/buchhaltung/`,
// `/einheitlicher-posteingang/`, `/mobile-app/`, `/gaestemanagement/`,
// `/buchungssystem/`, `/buchungswidget/`, `/ferienwohnung-homepage-baukasten/`
// …), Hostaway ebenso hinter seinem Feature-Menü. Der Grund ist nicht Optik:
// Wer „channel manager ferienwohnung" sucht, landet auf einer Seite, die genau
// diese eine Frage beantwortet — eine Startseite mit neun Kacheln beantwortet
// keine davon. Bis eben hatten wir gar keine solche Seite; das Menü zeigte auf
// den Anker `/#funktionen`.
//
// EINE QUELLE FÜR DEN NAMEN: Titel und Stichwortzeile kommen weiterhin aus
// `features.gruppen.<key>` (24 Sprachen, dieselben Texte wie Startseite,
// Preisseite und Megamenü). Neu je Seite sind nur die Abschnittstexte
// (`funktionen.<key>.*`). Eine zweite Fassung des Namens wäre die Doppelpflege,
// die wir überall sonst abgeschafft haben.

/** Schlüssel = Schlüssel der Funktionsgruppe in `features.gruppen`. */
export type FunktionsSchluessel =
  | "pms"
  | "channel"
  | "direkt"
  | "gaeste"
  | "zahlungen"
  | "preise"
  | "team"
  | "app"
  | "auswertungen";

export type Funktion = {
  key: FunktionsSchluessel;
  /** URL-Segment unter /funktionen/. Deutsch und sprechend, wie bei der Referenz. */
  slug: string;
  /**
   * Motiv der Produktaufnahme (`marketing/lib/app-aufnahmen.json`). Nur echte
   * Aufnahmen — für Funktionen ohne passendes Motiv steht `null`, dann zeigt
   * die Seite ihre Illustration groß statt eines fremden Screenshots.
   */
  aufnahme: string | null;
  /**
   * Zweites Motiv für den Beleg-Block. MUSS ein anderes sein als `aufnahme` —
   * dieselbe Aufnahme zweimal auf einer Seite liest sich wie ein Fehler.
   */
  aufnahmeBlock: string | null;
  /** Gruppierung im Menü und auf der Übersicht. */
  bereich: "verkauf" | "gast" | "betrieb";
  /**
   * Die Teilaspekte als Reiter (Referenz: hostaway.com/features/…, wo unter
   * jeder Funktion eine Chip-Reihe die Unterfunktionen aufblättert). Der
   * Schlüssel zeigt auf `funktionen.<key>.reiter.<key>`, `grafik` bestimmt die
   * gebaute Szene daneben.
   */
  reiter: readonly { key: string; grafik: GrafikArt }[];
};

/** Grafik-Arten aus `components/funktionen/funktions-grafiken.tsx`. */
export type GrafikArt =
  | "kanaele"
  | "nachrichten"
  | "checkliste"
  | "balken"
  | "preise"
  | "zahlung"
  | "belegung"
  | "zeichnung";

export const FUNKTIONEN: readonly Funktion[] = [
  {
    key: "pms",
    slug: "property-management",
    aufnahme: "belegungsplan",
    aufnahmeBlock: "belegungsplan-hotel",
    bereich: "verkauf",
    reiter: [{ key: "kalender", grafik: "belegung" }, { key: "einheiten", grafik: "checkliste" }, { key: "reservierung", grafik: "zeichnung" }, { key: "objektdaten", grafik: "kanaele" }],
  },
  {
    key: "channel",
    slug: "channel-manager",
    aufnahme: "kanaele",
    aufnahmeBlock: "belegungsplan",
    bereich: "verkauf",
    reiter: [{ key: "portale", grafik: "kanaele" }, { key: "sync", grafik: "belegung" }, { key: "stopsell", grafik: "checkliste" }, { key: "regeln", grafik: "zeichnung" }],
  },
  {
    key: "direkt",
    slug: "direktbuchung",
    aufnahme: "objekte",
    aufnahmeBlock: "kanaele",
    bereich: "verkauf",
    reiter: [{ key: "website", grafik: "zeichnung" }, { key: "widget", grafik: "checkliste" }, { key: "marktplatz", grafik: "kanaele" }, { key: "zahlung", grafik: "zahlung" }],
  },
  {
    key: "gaeste",
    slug: "gaesteerlebnis",
    aufnahme: "reservierungen",
    aufnahmeBlock: "mobil-kalender",
    bereich: "gast",
    reiter: [{ key: "posteingang", grafik: "nachrichten" }, { key: "automatisch", grafik: "checkliste" }, { key: "checkin", grafik: "zeichnung" }, { key: "mappe", grafik: "nachrichten" }],
  },
  {
    key: "zahlungen",
    slug: "zahlungen",
    aufnahme: "reservierungen",
    aufnahmeBlock: "dashboard",
    bereich: "gast",
    reiter: [{ key: "online", grafik: "zahlung" }, { key: "plaene", grafik: "checkliste" }, { key: "rechnungen", grafik: "zeichnung" }, { key: "eigentuemer", grafik: "balken" }],
  },
  {
    key: "preise",
    slug: "preise-und-umsatz",
    aufnahme: "dynamic-pricing",
    aufnahmeBlock: "belegungsplan",
    bereich: "gast",
    reiter: [{ key: "dynamisch", grafik: "preise" }, { key: "raten", grafik: "checkliste" }, { key: "rabatte", grafik: "belegung" }, { key: "grenzen", grafik: "zeichnung" }],
  },
  {
    key: "team",
    slug: "team-und-rollen",
    aufnahme: "dashboard",
    aufnahmeBlock: "reservierungen",
    bereich: "betrieb",
    reiter: [{ key: "rollen", grafik: "checkliste" }, { key: "aufgaben", grafik: "checkliste" }, { key: "eigentuemer", grafik: "balken" }, { key: "agentur", grafik: "zeichnung" }],
  },
  {
    key: "app",
    slug: "mobile-app",
    aufnahme: "mobil-kalender",
    aufnahmeBlock: "dashboard",
    bereich: "betrieb",
    reiter: [{ key: "betrieb", grafik: "belegung" }, { key: "meldungen", grafik: "nachrichten" }, { key: "gast", grafik: "zeichnung" }, { key: "rollen", grafik: "checkliste" }],
  },
  {
    key: "auswertungen",
    slug: "auswertungen",
    aufnahme: "dashboard",
    aufnahmeBlock: "belegungsplan-hotel",
    bereich: "betrieb",
    reiter: [{ key: "auslastung", grafik: "balken" }, { key: "kanaele", grafik: "kanaele" }, { key: "berichte", grafik: "checkliste" }, { key: "ausblick", grafik: "belegung" }],
  },
];

/** Nachschlagen über das URL-Segment; `undefined` für unbekannte Seiten (404). */
export function funktionNachSlug(slug: string): Funktion | undefined {
  return FUNKTIONEN.find((f) => f.slug === slug);
}
