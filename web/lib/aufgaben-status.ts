// Darstellung der Aufgaben-Zustände — EINE Quelle für Tabelle, Popover,
// Detailansicht und die Statusleiste.
//
// Vorher stand die Zuordnung dreimal im Code, jedes Mal etwas anders: die
// Tabelle zeigte `in_progress` als „offen" (ihr `StatusChip` behandelte nur
// done/cancelled gesondert und ließ alles andere in denselben Zweig fallen),
// der Popover übersetzte vier Werte, die Buchungsliste vier andere. Mit dem
// vierten Zustand `accepted` (0360) wäre daraus eine vierte Abweichung
// geworden — ein Zustand, den die Oberfläche schlicht verschweigt.
//
// Die i18n-Schlüssel liegen unter `reservations.taskStatus.*`.
import type { TaskStatus } from "@/lib/tasks";

export type StatusDarstellung = {
  /** i18n-Schlüssel unterhalb von `reservations.taskStatus`. */
  key: TaskStatus;
  icon: string;
  /** Tailwind-Textfarbe (semantische Tokens, keine Hex-Werte). */
  farbe: string;
};

export const AUFGABEN_STATUS: Record<TaskStatus, StatusDarstellung> = {
  open: { key: "open", icon: "ph:circle-dashed", farbe: "text-muted-foreground" },
  accepted: { key: "accepted", icon: "ph:hand-tap", farbe: "text-accent" },
  in_progress: { key: "in_progress", icon: "ph:play-circle", farbe: "text-accent" },
  done: { key: "done", icon: "ph:check-circle-fill", farbe: "text-success" },
  cancelled: { key: "cancelled", icon: "ph:prohibit", farbe: "text-muted-foreground" },
};

/** Reihenfolge der Arbeit — so stehen die Zustände in jeder Auswahl. */
export const STATUS_REIHENFOLGE: TaskStatus[] = [
  "open",
  "accepted",
  "in_progress",
  "done",
];

/**
 * Welche Zustände lassen sich von hier aus erreichen? Spiegelt
 * `TasksService._STATUS_WECHSEL` — die Oberfläche bietet nichts an, was der
 * Server mit 422 ablehnt. Der Server bleibt die Wahrheit; das hier erspart nur
 * den Fehlversuch.
 *
 * `cancelled` fehlt bewusst in den Vorschlägen: eine Aufgabe abzusagen ist
 * kein Schritt in der Arbeit, sondern ein Eingriff — er hängt am
 * „…"-Menü der Liste, nicht an der Statusleiste.
 */
export function naechsteZustaende(aktuell: TaskStatus): TaskStatus[] {
  if (aktuell === "done" || aktuell === "cancelled") return ["open"];
  return STATUS_REIHENFOLGE.filter((s) => s !== aktuell);
}
