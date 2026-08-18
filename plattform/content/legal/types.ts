// Struktur der Rechtstexte (Gast-AGB, Datenschutz, DSA-Angaben usw.). Inhalte
// liegen pro Dokument und Sprache als eigenes TS-Modul unter
// content/legal/<dokument>/<locale>.ts — bewusst ohne Markdown-Dependency;
// Inline-Links werden im Renderer aus der Schreibweise [Text](https://…)
// aufgelöst.
//
// Zwei Gliederungsebenen, weil die Nutzungsbedingungen sie brauchen:
// Abschnitt A/B (LegalSection) mit nummerierten Unterabschnitten A1…A22
// (LegalSubsection). Kurze Dokumente nutzen nur die obere Ebene.

// Ein Begriff aus dem Lexikon am Ende der Nutzungsbedingungen.
export type LegalDefinition = {
  term: string;
  description: string;
};

export type LegalSubsection = {
  // Anker für Inhaltsverzeichnis und Deep-Links („a7-preise"). Fehlt er, leitet
  // der Renderer ihn aus der Position ab — die Sprachfassungen tragen bewusst
  // DIESELBEN ids, damit ein Link über alle 24 Sprachen hinweg gilt.
  id?: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
};

export type LegalSection = {
  id?: string;
  heading: string;
  paragraphs?: string[];
  // Optionale Aufzählung, wird nach den Absätzen gerendert.
  list?: string[];
  subsections?: LegalSubsection[];
  definitions?: LegalDefinition[];
};

export type LegalDoc = {
  title: string;
  // Menschenlesbares Stand-Datum in der jeweiligen Sprache („Stand: 3. Juli 2026").
  stand: string;
  intro: string[];
  // Optionale Kurzfassung vor dem Inhaltsverzeichnis (Booking-Muster
  // „Zusammenfassung dieser Bedingungen") — sie ersetzt den Volltext NICHT.
  summary?: {
    heading: string;
    paragraphs: string[];
  };
  sections: LegalSection[];
};
