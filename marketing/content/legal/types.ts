// Datenmodell der Rechtsdokumente (Impressum, Datenschutz, Cookies, AVV).
// EIN Modell für alle vier, damit es genau EINEN Renderer gibt
// (components/legal/legal-document.tsx) und kein Dokument sein eigenes
// Layout mitbringt.
//
// Aufbau nach Branchenmuster (Lodgify/SiteMinder/Cloudbeds): Titel, Stand,
// Einleitung, Inhaltsverzeichnis mit Ankerlinks, numerierte Abschnitte mit
// a)/b)-Unterpunkten.

/** Label-Wert-Zeile für Angaben-Blöcke (Anbieter, Register, Kontakt). */
export type LegalZeile = {
  label: string;
  /** Mehrzeilige Werte (z. B. Anschrift) als eigene Zeilen. */
  werte: string[];
  /** Optionaler Link auf den ERSTEN Wert (mailto:/tel:/https:/relativ). */
  href?: string;
};

/** Unterpunkt eines Abschnitts — wird mit a), b), c) … numeriert. */
export type LegalUnterpunkt = {
  /** Optionale fette Vorzeile (z. B. Name eines Empfängers). */
  titel?: string;
  paragraphs?: string[];
  list?: string[];
};

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  /** Angaben-Block (dl) — z. B. Anbieter- oder Registerdaten. */
  zeilen?: LegalZeile[];
  /** Mit a), b), c) … numerierte Unterpunkte. */
  unterpunkte?: LegalUnterpunkt[];
  links?: { label: string; href: string }[];
};

export type LegalDoc = {
  /** Route ohne führenden Slash — auch Schlüssel in der Registry. */
  slug: string;
  title: string;
  /** <meta name="description"> der Seite. */
  metaDescription: string;
  /**
   * @deprecated Fertiger Satz „Stand: 6. August 2026". Führt dazu, dass eine
   * Sprachfassung entweder deutschen Text zeigt oder das Datum als übersetztes
   * Literal doppelt pflegt. Neue Fassungen setzen `standIso`.
   */
  stand?: string;
  /**
   * Stand-Datum als ISO-Datum (`YYYY-MM-DD`), z. B. `RECHTSSTAND_ISO`.
   *
   * Der Renderer macht daraus den Satz in der Sprache des Besuchers. Ist
   * `standIso` gesetzt, gewinnt es gegen `stand` — so lässt sich Datei für
   * Datei umstellen, ohne dass zwischendurch etwas bricht.
   */
  standIso?: string;
  intro: string[];
  sections: LegalSection[];
  /** Abschnitte mit 1., 2., 3. … numerieren (Verträge ja, Impressum nein). */
  numbered: boolean;
  /** Inhaltsverzeichnis mit Ankerlinks anzeigen (lange Dokumente). */
  toc: boolean;
};
