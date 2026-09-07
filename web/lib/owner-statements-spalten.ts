// Spalten der Buchungstabelle (0605) — Typ UND Standardreihenfolge.
//
// EIGENE DATEI OHNE "use server": `lib/owner-statements.ts` ist ein Server-
// Action-Modul und darf AUSSCHLIESSLICH async functions exportieren. Ein
// `export const` dort legt jede Seite, die das Modul importiert, mit 500 lahm
// („A "use server" file can only export async functions, found object") —
// und weder tsc noch ESLint sehen das (CLAUDE.md, MEMORY
// „use-server-nur-async-funktionen"). Live passiert am 07.09.2026 auf
// /eigentuemer/[id], direkt nach dem Einbau. Werte und Typen gehören deshalb
// hierher; das Server-Modul re-exportiert nur den Typ (der ist zur Laufzeit
// weg).
//
// Deckungsgleich mit Pydantic `ColumnKey` und dem DB-CHECK
// `owner_statements_column_order_check`. Die Reihenfolge = Standard. Die
// gespeicherte Folge gilt für Editor, Vorschau UND PDF: „wenn wir es
// verschieben wird es nicht an vorschau weitergeben" — deshalb am Beleg, nicht
// im Browser.
export type ColumnKey =
  | "guest"
  | "listing"
  | "check_in"
  | "check_out"
  | "nights"
  | "channel"
  | "gross"
  | "portal"
  | "commission"
  | "flat_fee"
  | "owner_payout";

export const COLUMN_ORDER_STANDARD: ColumnKey[] = [
  "guest",
  "listing",
  "check_in",
  "check_out",
  "nights",
  "channel",
  "gross",
  "portal",
  "commission",
  "flat_fee",
  "owner_payout",
];
