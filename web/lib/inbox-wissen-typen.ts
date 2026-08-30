// Werte und Typen der Wissensdatenbank — BEWUSST getrennt von `lib/inbox.ts`.
//
// `lib/inbox.ts` trägt `"use server"` und darf ausschliesslich async functions
// exportieren. Ein `const`-Array darin bricht den Build erst in „Collecting
// page data" mit `A "use server" file can only export async functions` — der
// Fehler nennt weder Zeile noch Symbol, und `tsc` wie ESLint sehen ihn nicht.
// Deshalb liegen Werte und Typen hier, in einer Datei ohne die Direktive.
export const WISSEN_KATEGORIEN = [
  "objekt",
  "anreise",
  "buchung",
  "umgebung",
  "stoerung",
  "ausstattung",
  "sonstiges",
] as const;
export type WissenKategorie = (typeof WISSEN_KATEGORIEN)[number];

export const WISSEN_QUELLEN = ["manual", "document", "message"] as const;
export type WissenQuelle = (typeof WISSEN_QUELLEN)[number];

/** Ergebnis eines Server-Action-Aufrufs. Steht hier, damit Komponenten den Typ
 *  importieren können: `lib/inbox.ts` hält ihn lokal, und ein `export type`
 *  aus einer "use server"-Datei ist zwar erlaubt, aber die Trennung macht
 *  sichtbar, was dort NICHT hingehört. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
