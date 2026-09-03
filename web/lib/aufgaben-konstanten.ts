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
  start_clock: null,
  end_clock: null,
  starts_on: null,
  ends_on: null,
  start_time: null,
  duration_minutes: null,
};

/** Auswahl für „wann die Aufgabe beginnen soll" (planmäßige Regeln). */
export const START_TRIGGER: TaskTrigger[] = [
  "booking_confirmed",
  // Die Tages-Anker stehen jeweils NEBEN ihrem Uhrzeit-Anker, weil genau dort
  // die Verwechslungsgefahr sitzt: „Beim Check-in" hängt an der Uhrzeit des
  // Gastes, „Am Anreisetag" nur am Datum.
  "check_in",
  "arrival_day",
  "after_check_in_24h",
  "check_out",
  "departure_day",
  "days_before_check_in",
  "days_after_check_out",
];

/** Für das Ende gibt es „bei Buchungsbestätigung" nicht — das wäre vor dem Start. */
export const END_TRIGGER: TaskTrigger[] = [
  "check_in",
  "arrival_day",
  "after_check_in_24h",
  "check_out",
  "departure_day",
  "days_before_check_in",
  "days_after_check_out",
];

/** Diese beiden Trigger brauchen zusätzlich eine Tagesangabe. */
export const TRIGGER_MIT_TAGEN: TaskTrigger[] = [
  "days_before_check_in",
  "days_after_check_out",
];

/** Diese beiden Auslöser tragen ihre Uhrzeit an der REGEL (0535) — bei allen
 *  anderen gilt die Uhrzeit der Buchung, und das Uhrzeitfeld bleibt aus. */
export const TRIGGER_MIT_UHRZEIT: TaskTrigger[] = ["arrival_day", "departure_day"];

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

/**
 * Beginn des nächsten Tages BEIM NUTZER, als ISO-Zeitstempel mit Zone.
 *
 * Nur im BROWSER aufrufen. Der Aufgaben-Server teilt die Reiter „Aktuell" und
 * „Bevorstehend" an dieser Grenze; er kann sie nicht selbst bilden, weil die
 * Zeitzone am Objekt hängt (`properties.timezone`) und eine Liste über mehrere
 * Objekte keine einzige richtige hat. In einer Server-Action wäre es die Zeit
 * des Rechenzentrums — deshalb steht der Helfer hier und nicht in `lib/tasks.ts`
 * (dort gilt „use server").
 *
 * Ohne diese Grenze verglich der Server gegen seine Uhr: eine heute um 16:00
 * fällige Aufgabe lag morgens unter „Bevorstehend", zwischen den Aufgaben der
 * nächsten Woche.
 */
export function tagesendeIso(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}
