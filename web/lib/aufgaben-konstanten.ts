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

/** Ein Datum im Datumsfilter, als `YYYY-MM-DD` (die Form von `<input
 *  type="date">`). Leer = diese Grenze ist offen. */
export type Zeitraum = { von: string; bis: string };

export const LEERER_ZEITRAUM: Zeitraum = { von: "", bis: "" };

/**
 * Die beiden Tagesdaten des Filters in ZEITPUNKTE umrechnen, wie sie das
 * Backend erwartet: `von` = Tagesbeginn, `bis` = Beginn des Tages DANACH
 * (exklusive Obergrenze).
 *
 * Nur im BROWSER aufrufen — derselbe Grund wie bei `tagesendeIso`: der
 * Kalendertag einer Aufgabe ist in der Zone des OBJEKTS definiert und die
 * Hälfte der Objekte hat keine gepflegte Zone, also darf der Server keine
 * unterstellen (Wurzel 4). Hier gilt die Zone des Bedieners, denn er hat
 * „20.08." in seinem Kalender gemeint.
 *
 * Warum `bis` exklusiv der Folgetag ist: der gewählte Endtag muss GANZ
 * enthalten sein. Mit dem Tagesbeginn als Obergrenze fiele eine Aufgabe am
 * 20.08. um 10:00 aus dem Filter „20.08.–20.08." heraus, und der Nutzer sähe
 * eine leere Liste für einen Tag, an dem Aufgaben stehen.
 */
export function zeitraumGrenzen(zeitraum: Zeitraum): {
  von?: string;
  bis?: string;
} {
  const grenzen: { von?: string; bis?: string } = {};
  if (zeitraum.von) {
    const start = new Date(`${zeitraum.von}T00:00:00`);
    if (!Number.isNaN(start.getTime())) grenzen.von = start.toISOString();
  }
  if (zeitraum.bis) {
    const ende = new Date(`${zeitraum.bis}T00:00:00`);
    if (!Number.isNaN(ende.getTime())) {
      ende.setDate(ende.getDate() + 1);
      grenzen.bis = ende.toISOString();
    }
  }
  return grenzen;
}
