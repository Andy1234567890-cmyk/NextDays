// Konstanten des Aufgaben-Moduls.
//
// Eigene Datei, weil `lib/tasks.ts` eine "use server"-Datei ist: dort dürfen
// ausschließlich async-Funktionen exportiert werden (Typen werden wegkompiliert,
// Werte nicht). Dasselbe Muster wie `lib/reviews-kanal.ts`.
import type { RuleSchedule, TaskTrigger } from "@/lib/tasks";

/** Sonderwert im Nutzerfilter: „Nicht zugeordnet" (wie bei Lodgify). */
export const UNASSIGNED = "none";

/** Vorlagen tragen keinen Zeitplan — dieser Block geht leer ans Backend. */
export const LEERER_ZEITPLAN: RuleSchedule = {
  template_rule_id: null,
  start_trigger: null,
  end_trigger: null,
  start_offset_minutes: 0,
  end_offset_minutes: 0,
  starts_on: null,
  ends_on: null,
  start_time: null,
  duration_minutes: null,
};

/** Auswahl für „wann die Aufgabe beginnen soll" (planmäßige Regeln). */
export const START_TRIGGER: TaskTrigger[] = [
  "booking_confirmed",
  "check_in",
  "after_check_in_24h",
  "check_out",
  "days_before_check_in",
  "days_after_check_out",
];

/** Für das Ende gibt es „bei Buchungsbestätigung" nicht — das wäre vor dem Start. */
export const END_TRIGGER: TaskTrigger[] = [
  "check_in",
  "after_check_in_24h",
  "check_out",
  "days_before_check_in",
  "days_after_check_out",
];

/** Diese beiden Trigger brauchen zusätzlich eine Tagesangabe. */
export const TRIGGER_MIT_TAGEN: TaskTrigger[] = [
  "days_before_check_in",
  "days_after_check_out",
];

export const MINUTEN_PRO_TAG = 1440;

/** Priorität 1–5 mit Wortlabel (5 = sofortig), wie bei Lodgify. */
export const PRIORITAETEN = [1, 2, 3, 4, 5] as const;

export const FREQUENZEN = ["daily", "weekly", "monthly", "yearly"] as const;

export const WOCHENTAGE = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
] as const;

export const MONATS_POSITIONEN = [
  "first",
  "second",
  "third",
  "fourth",
  "last",
] as const;
