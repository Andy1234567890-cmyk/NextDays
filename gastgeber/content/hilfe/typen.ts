// Struktur der myBestDays-Gastgeber-Hilfe.
//
// Bewusst EIGENE Inhalte statt der Marketing-Hilfe (marketing/content/help):
// die beschreibt myNextDays — PMS, Kanalmanager, Eigentuemererklaerungen. Ein
// Marktplatz-Gastgeber hat davon nichts; er fragt nach Inserat, Fotos, Preis,
// Buchung, Provision und Auszahlung. Die Markengrenze verlaeuft hier genau
// zwischen den beiden Haeusern (CLAUDE.md „Zwei Marken").
//
// Technik bewusst wie im Marketing-Center: typisierte TS-Module, kein Markdown-
// Paket. Inline-Links in der Schreibweise [Text](/pfad) loest der Renderer auf.

/** Ein Baustein im Artikel-Text. */
export type HilfeBlock =
  | { art: "p"; text: string }
  | { art: "h2"; text: string }
  | { art: "ul"; punkte: string[] }
  | { art: "schritte"; punkte: string[] }
  | { art: "hinweis"; ton?: "info" | "warnung" | "tipp"; text: string };

export type HilfeArtikel = {
  slug: string;
  titel: string;
  /** Kurzfassung fuer Listen und die Suche. */
  auszug: string;
  /**
   * Die Zeile ueber dem Titel — im Vorbild „So funktioniert es • Gastgeber:in
   * einer Unterkunft". Sie sagt, welcher ART der Artikel ist. Ohne sie liest
   * sich eine Anleitung wie eine Richtlinie und umgekehrt.
   */
  art?: "anleitung" | "richtlinie" | "grundlagen";
  text: HilfeBlock[];
};

export type HilfeKategorie = {
  slug: string;
  titel: string;
  beschreibung: string;
  /** Phosphor-Name (ph:*) — die App laedt Icons per @iconify/react zur Laufzeit. */
  icon: string;
  artikel: HilfeArtikel[];
};
