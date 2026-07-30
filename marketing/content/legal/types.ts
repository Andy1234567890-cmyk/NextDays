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
  /** „Stand: 30. Juli 2026" — sichtbar unter dem Titel. */
  stand: string;
  intro: string[];
  sections: LegalSection[];
  /** Abschnitte mit 1., 2., 3. … numerieren (Verträge ja, Impressum nein). */
  numbered: boolean;
  /** Inhaltsverzeichnis mit Ankerlinks anzeigen (lange Dokumente). */
  toc: boolean;
};
