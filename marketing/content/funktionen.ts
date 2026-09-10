// Die zehn Funktions-Unterseiten — welche es gibt, worauf sie zeigen.
//
// WARUM ES SIE GIBT (Referenz-Recherche 18.08.2026):
// Lodgify führt zu JEDER Funktion eine eigene Seite (`/ferienwohnung-channel-
// manager/`, `/dynamic-pricing/`, `/aufgabenmanagement/`, `/buchhaltung/`,
// `/einheitlicher-posteingang/`, `/mobile-app/`, `/gaestemanagement/`,
// `/buchungssystem/`, `/buchungswidget/`, `/ferienwohnung-homepage-baukasten/`
// …), Hostaway ebenso hinter seinem Feature-Menü. Der Grund ist nicht Optik:
// Wer „channel manager ferienwohnung" sucht, landet auf einer Seite, die genau
// diese eine Frage beantwortet — eine Startseite mit zehn Kacheln beantwortet
// keine davon. Bis eben hatten wir gar keine solche Seite; das Menü zeigte auf
// den Anker `/#funktionen`.
//
// EINE QUELLE FÜR DEN NAMEN: Titel und Stichwortzeile kommen weiterhin aus
// `features.gruppen.<key>` (24 Sprachen, dieselben Texte wie Startseite,
// Preisseite und Megamenü). Neu je Seite sind nur die Abschnittstexte
// (`funktionen.<key>.*`). Eine zweite Fassung des Namens wäre die Doppelpflege,
// die wir überall sonst abgeschafft haben.

import type { AppMotivMobil } from "@/lib/app-mobil";
import type { AusschnittName } from "@/components/marketing/oberflaechen-ausschnitt";

/** Schlüssel = Schlüssel der Funktionsgruppe in `features.gruppen`. */
export type FunktionsSchluessel =
  | "pms"
  | "channel"
  | "direkt"
  | "gaeste"
  | "ki"
  | "zahlungen"
  | "preise"
  | "team"
  | "app"
  | "auswertungen"
  | "eigentuemer";

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
  /**
   * Telefon-Aufnahmen der App (`lib/app-mobil.ts`). Gesetzt NUR auf Seiten, die
   * von der App handeln — dort ersetzen sie `aufnahme`/`aufnahmeBlock`, weil
   * eine hochkante Handy-Aufnahme in einem 16:10-Programmfenster-Rahmen als
   * leeres Fenster mit Bildstreifen liest. Zwei bis drei Motive je Stelle.
   */
  telefonHero?: readonly AppMotivMobil[];
  telefonBlock?: readonly AppMotivMobil[];
  /**
   * Telefon-Aufnahmen für einen EIGENEN App-Abschnitt zwischen Beleg-Block und
   * Weiterführung. Gesetzt, wenn die App nicht ein Detail der Funktion ist,
   * sondern ihre zweite Hälfte — bei der Eigentümer-Abrechnung sieht der
   * Eigentümer alles ausschließlich dort. Braucht die Texte
   * `funktionen.<key>.appAbschnitt.*`.
   */
  appReihe?: readonly AppMotivMobil[];
  /** Gruppierung im Menü und auf der Übersicht. */
  bereich: "verkauf" | "gast" | "betrieb";
  /**
   * Schlüssel einer ZWEITEN Zeichnung (`GRUPPEN_ILLUSTRATION`) für den
   * Beleg-Block. Nur nötig, solange eine Seite WEDER `aufnahmeBlock` NOCH
   * `telefonBlock` hat — dann stünde dort sonst dieselbe Zeichnung wie im
   * Hero, und zwei gleiche Bilder auf einer Seite lesen sich als Fehler.
   * Sobald die echten Aufnahmen liegen, kann das Feld wieder entfallen.
   */
  zweiteIllustration?: string;
  /**
   * Die Teilaspekte als Reiter (Referenz: hostaway.com/features/…, wo unter
   * jeder Funktion eine Chip-Reihe die Unterfunktionen aufblättert). Der
   * Schlüssel zeigt auf `funktionen.<key>.reiter.<key>`, `grafik` bestimmt die
   * gebaute Szene daneben.
   */
  reiter: readonly {
    key: string;
    grafik: GrafikArt;
    telefon?: readonly AppMotivMobil[];
    /** Echte Ausschnitte aus der Oberfläche (`AUSSCHNITTE` in
     *  `components/marketing/oberflaechen-ausschnitt.tsx`) — einer oder zwei.
     *  Schlagen wie `telefon` die gebaute Grafik. */
    ausschnitt?: readonly AusschnittName[];
  }[];
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
    // Die KI-Antwort ist eine EIGENE Seite und kein Reiter unter „gaeste":
    // wer „KI Antworten Ferienwohnung" sucht, sucht genau das — und die
    // Gästeerlebnis-Seite beantwortet die Frage nicht (dieselbe Begründung
    // wie im Kopf dieser Datei für die neun bestehenden Seiten).
    key: "ki",
    slug: "ki-antworten",
    // NOCH KEINE Aufnahme: die KI-Seite im Posteingang ist gebaut, aber weder
    // deployt noch fotografiert. `null` heisst „zeig die Zeichnung" — ein
    // gesetzter Name ohne Datei ergäbe eine leere getönte Fläche, also ein
    // sichtbares Loch im Hero (Wurzel 4: kein erfundener Ersatzwert).
    // Sobald `ki-antworten`/`ki-regeln` in `lib/app-aufnahmen.json` stehen,
    // werden hier die beiden Namen eingetragen — sonst nichts.
    aufnahme: null,
    aufnahmeBlock: null,
    bereich: "gast",
    zweiteIllustration: "kiRegeln",
    reiter: [
      { key: "kontext", grafik: "nachrichten" },
      { key: "regeln", grafik: "checkliste" },
      { key: "wissen", grafik: "zeichnung" },
      { key: "eskalation", grafik: "belegung" },
    ],
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
    // Keine Browser-Aufnahme: `mobil-kalender` war die WEB-App im
    // Handy-Viewport, kein Bild der nativen App. Hier stehen die echten
    // Telefon-Aufnahmen (alle neun, jede genau einmal).
    aufnahme: null,
    aufnahmeBlock: null,
    telefonHero: ["kalender-mehrere", "uebersicht"],
    telefonBlock: ["buchungen", "buchung-detail"],
    bereich: "betrieb",
    reiter: [
      { key: "betrieb", grafik: "belegung", telefon: ["inserate", "kalender"] },
      { key: "meldungen", grafik: "nachrichten", telefon: ["posteingang", "nachricht"] },
      // „Für den Gast" beschreibt die myBestDays-App und „Für das Team" die
      // Rollen-Ansichten — davon haben wir keine Aufnahmen. Lieber die
      // gebaute Grafik als eine fremde Ansicht als Beleg (Markengrenze).
      { key: "gast", grafik: "zeichnung" },
      // Der Login trägt „Melde dich mit deinem Betriebskonto an" — genau der
      // Punkt dieses Reiters: eine App, ein Konto, unterschiedliche Rechte.
      { key: "rollen", grafik: "checkliste", telefon: ["login"] },
    ],
  },
  {
    key: "auswertungen",
    slug: "auswertungen",
    aufnahme: "dashboard",
    aufnahmeBlock: "belegungsplan-hotel",
    bereich: "betrieb",
    reiter: [{ key: "auslastung", grafik: "balken" }, { key: "kanaele", grafik: "kanaele" }, { key: "berichte", grafik: "checkliste" }, { key: "ausblick", grafik: "belegung" }],
  },
  {
    // Eigentümer-Abrechnung und Eigentümer-App auf EINER Seite.
    //
    // Warum zusammen und nicht zwei Seiten: die App IST die Ansicht dieser
    // Abrechnung. Zwei Seiten müssten dieselben Beträge zweimal erklären, und
    // wer „Eigentümerabrechnung Ferienwohnung" sucht, will beides sehen — was
    // der Verwalter rechnet UND was der Eigentümer davon zu sehen bekommt.
    //
    // Es ist die einzige Seite mit Aufnahmen aus BEIDEN Welten: Hero und
    // Beleg-Block zeigen das Programmfenster des Betriebs, die Reiter die
    // Eigentümer-App. Das ist Absicht — die Funktion hat zwei Seiten eines
    // Vorgangs, und genau das trägt die Seite.
    key: "eigentuemer",
    slug: "eigentuemer-abrechnung",
    // Hero: das Programmfenster mit der fertigen Abrechnung — die Seite
    // handelt zuerst von dem, was der Verwalter rechnet.
    aufnahme: "eigentuemer-abrechnung",
    // Beleg-Block: die Eigentümer-Verwaltung mit Satz und zugeordneten
    // Objekten, passend zum Text „Mehrere Eigentümer, jeder mit eigenem Satz".
    aufnahmeBlock: "eigentuemer-liste",
    // Die App als eigener Abschnitt: Objektbestand, Auslastung und der Beleg
    // im Telefon — die drei Ansichten, die die Reiter nicht schon zeigen.
    appReihe: ["owner-auslastung", "owner-beleg", "owner-abrechnungen"],
    bereich: "betrieb",
    // Jeder Reiter zeigt eine ECHTE Aufnahme, keiner eine gebaute Grafik —
    // die einzige Seite, für die alle fünf vorliegen. Die `grafik` bleibt
    // trotzdem gesetzt: sie ist der Rückfall, falls eine Aufnahme später
    // wegfällt, und der Typ verlangt sie.
    reiter: [
      { key: "abrechnung", grafik: "balken", ausschnitt: ["beleg"] },
      { key: "vertrag", grafik: "checkliste", ausschnitt: ["vertrag", "zuweisung"] },
      { key: "portale", grafik: "kanaele", ausschnitt: ["abzugssaetze"] },
      { key: "app", grafik: "belegung", telefon: ["owner-finanzen", "owner-abrechnungen"] },
      { key: "eigennutzung", grafik: "zeichnung", telefon: ["owner-kalender", "owner-buchen"] },
      // Die Objektakte statt eines eigenen Chat-Reiters: Der Chat existiert,
      // aber die vorliegende Aufnahme zeigt einen LEEREN Verlauf und die Zeile
      // „Ende-zu-Ende verschlüsselt" — seit dem Umbau auf serverseitige
      // Verschlüsselung eine Falschaussage, am 09.09.2026 aus der App
      // entfernt. Ein leerer Verlauf beweist nichts, ein retuschiertes Bild
      // wäre ein gefälschter Produktbeweis. Der Reiter zeigt deshalb, WORAN
      // die Korrespondenz hängt — am Objekt —, und der Text nennt sie als
      // Teil der Akte. Liegt eine Aufnahme mit echtem Verlauf vor, wird
      // daraus ein eigener Reiter.
      { key: "objektakte", grafik: "nachrichten", telefon: ["owner-objekte", "owner-objekt"] },
    ],
  },
];

/** Nachschlagen über das URL-Segment; `undefined` für unbekannte Seiten (404). */
export function funktionNachSlug(slug: string): Funktion | undefined {
  return FUNKTIONEN.find((f) => f.slug === slug);
}
