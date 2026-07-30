// Struktur des Hilfe-Centers (Zendesk-/Lodgify-Muster), adaptiert an myNextDays.
// Inhalte liegen als typisierte TS-Module unter content/help/articles/<slug>.ts —
// bewusst ohne Markdown-Dependency; Inline-Links werden im Renderer aus der
// Schreibweise [Text](https://…) bzw. [Text](/hilfe/…) aufgelöst.
// Texte sind auf Deutsch (Basissprache); wie bei den Rechtstexten fällt der
// Rest der 24 Sprachen über den next-intl-Merge auf DE zurück.

// Ein Baustein im Artikel-Body. Bewusst klein gehalten — deckt Fließtext,
// Zwischenüberschriften, Aufzählungen, nummerierte Schritte und Hinweis-Callouts.
export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "note"; variant?: "info" | "warn" | "tip"; text: string };

export type HelpArticle = {
  slug: string;
  title: string;
  // Kurzer Auszug für Listen/Kacheln und den Suchindex.
  excerpt: string;
  // Menschenlesbares Stand-Datum ("Stand: Juli 2026").
  updated: string;
  body: HelpBlock[];
};

// Innerhalb einer Kategorie gruppieren Sektionen die Artikel (Überschrift auf
// der Kategorieseite) — spiegelt die Lodgify-Sektionen.
export type HelpSection = {
  heading: string;
  articles: HelpArticle[];
};

// Zwei Sammlungen wie bei Lodgify: Wissensdatenbank (Feature-Doku) und
// Anwendungsfälle (aufgabenorientiert).
export type HelpCollection = "kb" | "usecases";

export type HelpCategory = {
  slug: string;
  title: string;
  description: string;
  // Iconify-Name (ph:*), gerendert via @iconify/react — nie lucide (PROJECT.md §2).
  icon: string;
  collection: HelpCollection;
  sections: HelpSection[];
};
