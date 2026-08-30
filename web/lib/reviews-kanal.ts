// Kanal-Code der eigenen Marktplatz-Bewertungen (deckungsgleich mit ota_name).
//
// Eigene Datei, weil `lib/reviews.ts` eine "use server"-Datei ist: dort darf
// NUR Asynchrones exportiert werden. Eine exportierte Konstante bricht dort den
// Build ("Only async functions are allowed to be exported in a 'use server'
// file") — und zwar den ganzen, nicht nur die Bewertungen.
export const MARKETPLACE_CHANNEL = "myBestDays";

// Exportierbare Spalten der Bewertungstabelle. Deckungsgleich mit
// `reviews/export.py:SPALTEN` — ein Name, den das Backend nicht kennt, wird
// dort still übergangen, die Spalte fehlt dann in der Datei, ohne dass es
// jemandem auffällt.
//
// Auch das steht hier und nicht in `lib/reviews.ts`: derselbe Grund wie oben.
export const EXPORT_SPALTEN = [
  "received_at",
  "channel",
  "origin",
  "author",
  "property",
  "score",
  "scale",
  "score_5",
  "text",
  "reply",
  "replied",
  "hidden",
  "ai_sentiment",
  "ai_themes",
  "ai_summary",
] as const;

export type ExportSpalte = (typeof EXPORT_SPALTEN)[number];

// Was die Tabelle ohne eigene Wahl zeigt UND exportiert — deckungsgleich mit
// `export.STANDARD`.
export const STANDARD_SPALTEN: readonly ExportSpalte[] = [
  "received_at",
  "channel",
  "origin",
  "author",
  "property",
  "score_5",
  "text",
  "replied",
];
