// Struktur der Rechtstexte (Gast-AGB usw.). Inhalte liegen pro Sprache als
// eigenes TS-Modul unter content/legal/agb/<locale>.ts — bewusst ohne
// Markdown-Dependency; Inline-Links werden im Renderer aus der Schreibweise
// [Text](https://…) aufgelöst.
export type LegalSection = {
  heading: string;
  paragraphs: string[];
  // Optionale Aufzählung, wird nach den Absätzen gerendert.
  list?: string[];
};

export type LegalDoc = {
  title: string;
  // Menschenlesbares Stand-Datum in der jeweiligen Sprache („Stand: 3. Juli 2026").
  stand: string;
  intro: string[];
  sections: LegalSection[];
};
