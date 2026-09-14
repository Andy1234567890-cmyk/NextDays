// Gruppierung der Automatisierungen nach Lebenszyklus — die Ordnung, in der
// Lodgify seine „Geplanten Nachrichten" zeigt: Vor der Ankunft · Während des
// Aufenthalts · Nach der Abreise.
//
// Bewusst ABGELEITET statt gespeichert: Lodgify hat feste Ereignis-Kategorien,
// unser Modell ist freier (Trigger + Anker + Offset). Eine zusätzlich
// gespeicherte Kategorie wäre eine zweite Wahrheit für dieselbe Regel und
// könnte vom tatsächlichen Zeitplan abweichen — dann stünde eine Regel unter
// „Nach der Abreise", die in Wahrheit vor der Anreise feuert.

import type { Automation, AutomationTrigger } from "@/lib/inbox";

export type PhasenSchluessel = "before" | "during" | "after";

/**
 * Auslöser → Anker und Richtung. Spiegelt `ausloeser.py` im Backend (0307).
 *
 * Der Auslöser sagt beides zugleich: an welchem Datum die Regel hängt und auf
 * welcher Seite davon sie feuert. Bis 0307 waren Anker und Richtung zusätzlich
 * frei wählbar — eine Regel konnte „Vor Anreise" heißen und vor der ABREISE
 * feuern (live so vorgefunden). Deshalb steht die Zuordnung hier EINMAL; die
 * Maske fragt nur noch nach dem Betrag.
 */
export const AUSLOESER: Record<
  Exclude<AutomationTrigger, "message_received">,
  { anker: string; richtung: 1 | 0 | -1 }
> = {
  booking_new: { anker: "booking", richtung: 1 },
  before_checkin: { anker: "arrival", richtung: -1 },
  on_checkin: { anker: "arrival", richtung: 0 },
  after_checkin: { anker: "arrival", richtung: 1 },
  before_checkout: { anker: "departure", richtung: -1 },
  on_checkout: { anker: "departure", richtung: 0 },
  after_checkout: { anker: "departure", richtung: 1 },
};

/** Auslöser, die AM Ankertag feuern statt in einem Abstand dazu (0515).
 *
 *  Sie haben KEIN Abstandsfeld: „am Anreisetag, aber 3 Tage später" ist kein
 *  gültiger Gedanke. Die Maske blendet die Zahl deshalb aus, und der Server
 *  zwingt jeden mitgeschickten Betrag auf null (`versatz_normieren`). */
export const TAGES_TRIGGER: AutomationTrigger[] = ["on_checkin", "on_checkout"];

export function istTagesTrigger(t: AutomationTrigger): boolean {
  return (TAGES_TRIGGER as string[]).includes(t);
}

/** Die Auslöser in der Reihenfolge des Aufenthalts (Buchung → Anreise → Abreise). */
export const AUSLOESER_REIHENFOLGE: AutomationTrigger[] = [
  "booking_new",
  "before_checkin",
  "on_checkin",
  "after_checkin",
  "before_checkout",
  "on_checkout",
  "after_checkout",
  "message_received",
];

/** Bezugsdatum des Auslösers; für `message_received` bedeutungslos. */
export function ankerVon(trigger: AutomationTrigger): string {
  return AUSLOESER[trigger as keyof typeof AUSLOESER]?.anker ?? "arrival";
}

/** +1 = nach dem Anker, −1 = davor, 0 = am Anker selbst (0515).
 *
 *  Wer daraus „vor/nach" ableitet, muss die 0 ZUERST abfangen: `richtung < 0`
 *  als „vor" und sonst „nach" zu lesen ergäbe „0 Tage nach Anreise" statt
 *  „Am Anreisetag". Dafür gibt es `istTagesTrigger`. */
export function richtungVon(trigger: AutomationTrigger): 1 | 0 | -1 {
  return AUSLOESER[trigger as keyof typeof AUSLOESER]?.richtung ?? 1;
}

// Kanal-Werte = ota_name-Herkunft (Backend matcht case-insensitive). Der eigene
// Marktplatz „myBestDays" ist ein eigener Kanal wie die OTAs (booking_engine
// setzt ota_name="myBestDays"), NICHT „Direkt". Altbestand: 0239.
//
// Hier und nicht in einer der beiden Oberflächen: Tab und Panel bearbeiten
// DIESELBE Regel. Zwei Listen hießen, dass ein Kanal je nach Weg wählbar ist
// oder nicht — und die Regel unbemerkt einen Kanal verliert.
//
// `portal` sagt NUR, ob der Kanal über ein fremdes Portal läuft — und damit,
// ob eine Nachricht dort im Gast-Chat des Portals landet (kein Betreff) oder
// per E-Mail hinausgeht. Es ist ausdrücklich KEINE Aussage darüber, ob dieser
// Kanal beim Betrieb verbunden ist; das steht im Kanalmanager und wird hier
// nicht behauptet (Wurzel 4).
export type AutomationKanal = { name: string; portal: boolean };

export const AUTOMATION_KANAL_LISTE: AutomationKanal[] = [
  // Nicht-Portal-Kanäle zuerst: sie sind der Regelfall eines Betriebs, der
  // seine eigene Seite und den Marktplatz bedient.
  { name: "Direkt", portal: false },
  { name: "Website", portal: false },
  { name: "myBestDays", portal: false },
  { name: "Booking.com", portal: true },
  { name: "Airbnb", portal: true },
  { name: "Vrbo", portal: true },
  { name: "Expedia", portal: true },
];

export const AUTOMATION_KANAELE: string[] = AUTOMATION_KANAL_LISTE.map(
  (k) => k.name,
);

/** Läuft dieser Kanal über ein fremdes Portal? (Vergleich wie im Backend
 *  case-insensitive — `ota_name` kommt je Quelle unterschiedlich geschrieben.) */
export function istPortalKanal(name: string): boolean {
  const gesucht = name.trim().toLowerCase();
  return AUTOMATION_KANAL_LISTE.some(
    (k) => k.portal && k.name.toLowerCase() === gesucht,
  );
}

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
  // wie „2 Tage nach Abreise". Rückfall auf `offset_days`, solange ein Server
  // die 0303-Felder noch nicht mitliefert.
  const versatz = a.offset_value ?? a.offset_days ?? 0;
  if (a.anchor === "departure") return versatz > 0 ? "after" : "during";
  return versatz > 0 ? "during" : "before";
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
  return ankerRang * 10_000_000 + (a.offset_value ?? a.offset_days ?? 0) * proEinheit;
}

/**
 * Übersetzerfunktion, wie `useTranslations("inbox")` sie liefert.
 *
 * Die Zeitplan-Zeile braucht Sprachschlüssel, dieses Modul kennt aber keinen
 * React-Kontext. Sie wird deshalb hereingereicht — dadurch bleibt die Logik an
 * EINER Stelle, statt sie in jeder Oberfläche neu zu bauen.
 */
export type UebersetzenFn = (
  schluessel: string,
  werte?: Record<string, string | number | Date>,
) => string;

/**
 * Der Zeitplan einer Regel als Satz: „3 Tage vor Anreise · 07:45 (Ortszeit)".
 *
 * EINE Funktion für Tab und Panel. Vorher gab es zwei (`scheduleLabel` im Tab,
 * `zeitplanText` im Panel), die sich bereits unterschieden: das Panel zeigte
 * die Wochentage des Zeitfensters nicht, der Tab den Auslösernamen nicht.
 * Dieselbe Regel hieß je nach Weg anders — genau der Zustand, den die
 * gemeinsame Kanalliste darüber schon einmal beendet hat.
 */
export function zeitplanText(a: Automation, t: UebersetzenFn): string {
  const fenster = fensterText(a, t);
  if (!istZeitplanRegel(a)) {
    // Abwesenheitsantwort: sie hängt an keinem Datum, das Fenster IST ihr
    // Zeitplan. Ohne Fenster gilt sie rund um die Uhr.
    return fenster || t("autoAlways");
  }
  // `offset_value`/`offset_unit` kamen mit 0303 dazu. Ein Server, der die
  // Felder noch nicht liefert (laufender Prozess vor dem Neustart), schickt
  // `undefined` — daraus wurde `autoUnit_undefined` und die ganze Liste kippte
  // mit MISSING_MESSAGE. Auf die Tages-Sicht zurückfallen, statt zu zerbrechen.
  const einheit = a.offset_unit ?? "days";
  const versatz = a.offset_value ?? a.offset_days ?? 0;
  const abs = Math.abs(versatz);
  const anker = t(`autoAnchor_${a.anchor}`);
  // Die Uhrzeit gilt IMMER in der Ortszeit des Objekts (14.09.2026): der
  // Kunde stellt 06:00 ein und meint sechs Uhr vor Ort. Eine zweite Deutung
  // („UTC" ohne Haken) gibt es nicht mehr.
  const zeit = a.send_time ? ` · ${a.send_time} (${t("autoLocalTime")})` : "";
  // Das Fenster gilt seit 14.09.2026 für JEDEN Auslöser (es verschiebt den
  // Versand auf den nächsten Fensterbeginn). Es hier wegzulassen hieße, eine
  // Einstellung zu verstecken, die den angezeigten Zeitpunkt verschiebt.
  const anhang = fenster ? ` · ${fenster}` : "";
  if (abs === 0) {
    return `${t("autoOnDayOf", { anchor: anker })}${zeit}${anhang}`;
  }
  const richtung = versatz < 0 ? t("autoBefore") : t("autoAfter");
  return `${abs} ${t(`autoUnit_${einheit}`)} ${richtung} ${anker}${zeit}${anhang}`;
}

/** Sendefenster als Text („08:00–20:00 · Mo, Di"); leer, wenn keines gesetzt ist. */
export function fensterText(a: Automation, t: UebersetzenFn): string {
  const spanne =
    a.window_from && a.window_to ? `${a.window_from}–${a.window_to}` : "";
  const tage =
    a.window_days.length > 0
      ? a.window_days.map((d) => t(`autoDay_${d}`)).join(", ")
      : "";
  return [spanne, tage].filter(Boolean).join(" · ");
}

/**
 * Die ganze Zeile unter dem Namen: Auslöser · Zeitplan.
 *
 * Bei Versatz 0 steht das Auslöser-Etikett NICHT davor: „Vor Anreise" und
 * „Am Tag der Anreise" widersprechen sich im selben Satz. Der Zeitplan sagt
 * dort schon alles.
 */
export function ausloeserUndZeitplan(a: Automation, t: UebersetzenFn): string {
  const zeitplan = zeitplanText(a, t);
  const versatz = a.offset_value ?? a.offset_days ?? 0;
  if (istZeitplanRegel(a) && versatz === 0) return zeitplan;
  const ausloeser = t(`autoTrigger_${a.trigger}`);
  return `${ausloeser} · ${zeitplan}`;
}

/**
 * Wie viele aktive Objekte des Betriebs stehen NICHT in dieser Regel?
 *
 * Eine feste Objektliste altert still: ein neu angelegtes Haus fiel bis zum
 * 14.09.2026 aus jeder Regel mit Liste, ohne dass das irgendwo stand. Die Zahl
 * gehört deshalb an BEIDE Oberflächen — und darum steht die Rechnung hier und
 * nicht in einer davon.
 *
 * Leere Liste = „alle Unterkünfte", also nie eine Lücke.
 */
export function nichtAbgedeckt(
  a: Automation,
  objekte: { id: string }[],
): number {
  if (a.property_ids.length === 0) return 0;
  return objekte.filter((o) => !a.property_ids.includes(o.id)).length;
}
