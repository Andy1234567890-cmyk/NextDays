// Gruppierung der Automatisierungen nach Lebenszyklus — die Ordnung, in der
// Lodgify seine „Geplanten Nachrichten" zeigt: Vor der Ankunft · Während des
// Aufenthalts · Nach der Abreise.
//
// Bewusst ABGELEITET statt gespeichert: Lodgify hat feste Ereignis-Kategorien,
// unser Modell ist freier (Trigger + Anker + Offset). Eine zusätzlich
// gespeicherte Kategorie wäre eine zweite Wahrheit für dieselbe Regel und
// könnte vom tatsächlichen Zeitplan abweichen — dann stünde eine Regel unter
// „Nach der Abreise", die in Wahrheit vor der Anreise feuert.

import type { Automation } from "@/lib/inbox";

export type PhasenSchluessel = "before" | "during" | "after";

/** Die drei Abschnitte in ihrer Reihenfolge im Panel. */
export const PHASEN: PhasenSchluessel[] = ["before", "during", "after"];

/**
 * In welchen Abschnitt gehört diese Regel?
 *
 * Maßgeblich ist, WANN sie relativ zum Aufenthalt feuert:
 *   * Anker „Buchung" → immer vor der Ankunft (die Buchung geht ihr voraus).
 *   * Anker „Anreise": davor/am Tag → vor der Ankunft, danach → im Aufenthalt.
 *   * Anker „Abreise": davor/am Tag → im Aufenthalt, danach → nach der Abreise.
 *
 * Die Abwesenheitsantwort (`message_received`) hängt an keinem Datum der
 * Reservierung. Sie käme sonst willkürlich in einen Abschnitt; sie bekommt
 * deshalb einen eigenen (s. `istZeitplanRegel`).
 */
export function phaseVon(a: Automation): PhasenSchluessel {
  if (a.anchor === "booking") return "before";
  // Maßgeblich ist das VORZEICHEN, nicht der Betrag — deshalb ist die Einheit
  // hier gleichgültig: „2 Stunden nach Abreise" liegt so gut nach der Abreise
  // wie „2 Tage nach Abreise".
  if (a.anchor === "departure") return a.offset_value > 0 ? "after" : "during";
  return a.offset_value > 0 ? "during" : "before";
}

/** Hat diese Regel überhaupt einen Zeitplan? (message_received hat keinen.) */
export function istZeitplanRegel(a: Automation): boolean {
  return a.trigger !== "message_received";
}

/**
 * Sortierschlüssel INNERHALB eines Abschnitts: chronologisch entlang des
 * Aufenthalts. „3 Tage vor Anreise" steht vor „1 Tag vor Anreise", und beide
 * vor „Am Anreisetag" — so liest sich die Liste wie der Ablauf selbst.
 *
 * Die Anker liegen in fester Reihenfolge auf der Zeitachse (Buchung → Anreise
 * → Abreise); innerhalb eines Ankers entscheidet der Offset.
 */
export function zeitachse(a: Automation): number {
  const ankerRang = a.anchor === "booking" ? 0 : a.anchor === "arrival" ? 1 : 2;
  // Auf Minuten normalisieren, sonst stünde „30 Minuten vor Anreise" vor
  // „2 Tage vor Anreise", weil 30 > 2 ist — die Zahl allein sagt nichts,
  // solange die Einheit daneben steht.
  const proEinheit = a.offset_unit === "minutes" ? 1 : a.offset_unit === "hours" ? 60 : 1440;
  return ankerRang * 10_000_000 + a.offset_value * proEinheit;
}
