// Werte des Inventar-Slice — bewusst NICHT in `property-dossier.ts`.
//
// Jene Datei trägt `"use server"` und darf AUSSCHLIESSLICH async functions
// exportieren. Ein `export const` darin bricht die Seite zur Laufzeit mit
// „A 'use server' file can only export async functions, found object" — und
// zwar erst beim Aufruf, nicht beim Kompilieren: `tsc` und ESLint sehen es
// NICHT. Genau das ist hier am 10.09.2026 passiert.
//
// Typen dürfen drüben bleiben (sie verschwinden beim Übersetzen), Werte nicht.

/** Wie oft eine Inventarzeile gezählt wird.
 *
 *  `jede_abreise` landet auf der Reinigungs-Checkliste — die Zählung passiert
 *  dort, wo ohnehin jemand steht. Ohne die anderen Stufen stünden 200 Zeilen
 *  auf jeder Abreise und niemand hakte sie noch ab. */
export const ZAEHL_RHYTHMEN = [
  "jede_abreise",
  "quartal",
  "jaehrlich",
  "nie",
] as const;

/** Zustand für die Ersatzplanung — unabhängig vom Schaden: ein Sofa kann heil
 *  und trotzdem durchgesessen sein. */
export const ZUSTAENDE = ["neu", "gut", "abgenutzt", "ersatz_faellig"] as const;

export type ZaehlRhythmus = (typeof ZAEHL_RHYTHMEN)[number];
export type Zustand = (typeof ZUSTAENDE)[number];
