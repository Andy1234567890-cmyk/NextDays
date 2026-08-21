// Das Statusbild einer Aufgabe — EINE Quelle für Beschriftung und Farbe,
// gespiegelt aus `web/components/reservierungen/tasks-calendar.tsx`
// (`taskStyle`). Dieselbe Semantik in Liste, Kalender und Detail:
//
//   GRÜN    erledigt
//   GRAU    abgebrochen
//   AMBER   offen und heute fällig — heute anzufassen
//   ROT     offen und NIEMANDEM zugewiesen — kann so nicht erledigt werden
//   NEUTRAL offen, zugewiesen, kein Hinweis
//
// Wie in `lib/buchungsstatus.ts` sind die Farben absichtlich fest und nicht aus
// der Palette: sie tragen eine BEDEUTUNG, die sich nicht mit dem Markenakzent
// ändern darf. Die Reihenfolge der Prüfungen ist die des Webs — „heute fällig"
// gewinnt über „niemand zugewiesen", sonst verschwindet die Tagesdringlichkeit
// hinter einer Zuweisungslücke.
import { aufgabenTag } from "@/lib/aufgaben-agenda";
import type { TaskStatus } from "@/lib/tasks";

export const AUFGABE_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Offen",
  // „Angenommen" (0360): jemand hat zugesagt, aber noch nicht angefangen.
  accepted: "Angenommen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

/**
 * Der nächste Arbeitszustand — offen → angenommen → in Arbeit → erledigt.
 *
 * Eine Quelle für Liste, Kalender und Detail; vorher stand die Kette im
 * Listen-Screen und kannte `accepted` nicht, weshalb eine angenommene Aufgabe
 * dort keinen Weiter-Knopf mehr hatte. Aus `done`/`cancelled` führt hier kein
 * Weg — das Zurücknehmen ist eine eigene Entscheidung, kein „weiter".
 */
export function naechsterStatus(s: TaskStatus): TaskStatus | null {
  if (s === "open") return "accepted";
  if (s === "accepted") return "in_progress";
  if (s === "in_progress") return "done";
  return null;
}

/** Welche Bedeutung die Karte trägt — nicht der rohe Status. */
export type AufgabeTon = "done" | "cancelled" | "today" | "unassigned" | "plain";

export const AUFGABE_TONE: Record<AufgabeTon, { bg: string; fg: string }> = {
  done: { bg: "#E6F4EA", fg: "#1E7A46" },
  cancelled: { bg: "#EDEDED", fg: "#5A5A5A" },
  today: { bg: "#FCF0DA", fg: "#9A6B12" },
  unassigned: { bg: "#FBE4E4", fg: "#B02A2A" },
  plain: { bg: "transparent", fg: "" },
};

/** Der Zusatzhinweis neben dem Status — leer, wenn es nichts zu sagen gibt. */
export const AUFGABE_TON_HINWEIS: Record<AufgabeTon, string | null> = {
  done: null,
  cancelled: null,
  today: "Heute fällig",
  unassigned: "Niemand zugewiesen",
  plain: null,
};

type Bewertbar = {
  status: TaskStatus;
  assignee_id: string | null;
  start_at: string | null;
  due_at: string | null;
};

/**
 * Der Anzeige-Ton einer Aufgabe.
 *
 * `heuteIso` ist ein Parameter (kein `new Date()` hier), damit die Ableitung
 * testbar ist, ohne die Systemzeit zu verbiegen — dasselbe Muster wie
 * `tagKurz(iso, heuteJahr)`.
 */
export function aufgabeTon(task: Bewertbar, heuteIso: string): AufgabeTon {
  if (task.status === "done") return "done";
  if (task.status === "cancelled") return "cancelled";
  // Über `aufgabenTag` und nicht über `iso.slice(0, 10)`: der Ton muss denselben
  // Tag benutzen wie die Gruppe, unter der die Karte steht. Sonst steht eine
  // Aufgabe unter „Samstag" und trägt daneben „Heute fällig".
  if (aufgabenTag(task) === heuteIso) return "today";
  if (!task.assignee_id) return "unassigned";
  return "plain";
}
