// Aufbereitung der Aufgaben für Liste und Aufgaben-Kalender: welcher TAG eine
// Aufgabe trägt, wie ihr Zeitfenster heißt, wie die Tagesgruppen und der
// Wochenstreifen aussehen. Reine Datenlogik, kein UI — deterministisch und
// ohne erfundene Werte (fehlt ein Zeitpunkt, kommt `null`, nie „00:00").
//
// Der TAG einer Aufgabe ist der LOKALE Tag von `start_at`, sonst von `due_at` —
// dieselbe Reihenfolge, mit der das Backend seinen Kalender füllt
// (`_calendar_tasks`: „start_at ODER Fälligkeit due_at"). Bewusst nicht
// `iso.slice(0, 10)` wie im Web: das liest den UTC-Tag. Eine Aufgabe, die um
// 23:30 Ortszeit beginnt, stünde damit unter dem FOLGETAG, und der Hinweis
// „heute fällig" widerspräche der Gruppe, unter der sie steht.
import { isoLocal, parseLocal } from "@/lib/calendar-grid";
import type { Task, TaskStatus } from "@/lib/tasks";

type Terminiert = Pick<Task, "start_at" | "due_at" | "end_at">;

/** Wie viele Tage eine Aufgabe höchstens überspannen darf, bevor die
 * Mehrtages-Darstellung als Fehlkonfiguration gilt. */
const MAX_TAGE = 31;

/** Der lokale Kalendertag einer Aufgabe, oder null wenn sie keinen trägt. */
export function aufgabenTag(task: Pick<Task, "start_at" | "due_at">): string | null {
  const roh = task.start_at ?? task.due_at;
  if (!roh) return null;
  const d = new Date(roh);
  return Number.isNaN(d.getTime()) ? null : isoLocal(d);
}

/**
 * ALLE lokalen Kalendertage, die eine Aufgabe berührt — von `start_at` bis
 * `end_at ?? due_at`.
 *
 * Der Grund: eine planmäßige Regel spannt regelmäßig zwei Tage. „Velk T"
 * (Wechsel) läuft von „ein Tag vor Anreise" bis „Anreise", live also vom
 * 22.08. 18:00 bis 23.08. 18:00. `aufgabenTag` liefert davon nur den
 * STARTTAG — am Anreisetag selbst, an dem die Arbeit anfällt, stand die
 * Aufgabe nicht in der Tagesliste und der Tag trug keinen Punkt. Gemeldet
 * wurde das als „am 23.8. fehlt der Wechsel".
 *
 * Obergrenze gegen eine kaputt konfigurierte Dauer (Wurzel 8): mehr als
 * `MAX_TAGE` Tage wären keine Aufgabe mehr, sondern ein Dauerzustand — dann
 * bleibt es beim Starttag.
 */
export function aufgabenTage(
  task: Pick<Task, "start_at" | "due_at" | "end_at">,
): string[] {
  const start = aufgabenTag(task);
  if (start === null) return [];
  const endeRoh = task.end_at ?? task.due_at;
  if (!endeRoh) return [start];
  const ende = new Date(endeRoh);
  if (Number.isNaN(ende.getTime())) return [start];
  const endeTag = isoLocal(ende);
  if (endeTag <= start) return [start];
  const tage: string[] = [];
  const lauf = parseLocal(start);
  const grenze = parseLocal(endeTag);
  while (lauf <= grenze && tage.length < MAX_TAGE) {
    tage.push(isoLocal(lauf));
    lauf.setDate(lauf.getDate() + 1);
  }
  return tage.length < MAX_TAGE ? tage : [start];
}

/**
 * Trägt dieser Zeitstempel überhaupt eine Uhrzeit?
 *
 * Die Regel-Engine setzt bewusst den TAGESBEGINN (00:00 UTC), wenn die Buchung
 * keine Check-in-/Check-out-Zeit kennt — sie erfindet keine Standardstunde
 * (Wurzel 4). Live betrifft das 129 von 304 Buchungen; die daraus erzeugten
 * Aufgaben trugen in der App „fällig 2:00", weil 00:00 UTC in Kopenhagen 02:00
 * ist. Das ist genau die erfundene Uhrzeit, die das Backend vermeiden wollte —
 * nur eine Ebene später. Ein solcher Zeitstempel bedeutet „dieser Tag", nicht
 * „nachts um zwei".
 *
 * Preis der Erkennung: eine Aufgabe, die WIRKLICH auf 00:00 UTC terminiert ist,
 * verliert ihre Uhrzeitangabe. Für Reinigung und Wechsel gibt es diesen Termin
 * nicht — und eine fehlende Angabe ist allemal besser als eine falsche.
 */
function hatUhrzeit(d: Date): boolean {
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
}

/** Uhrzeit eines Zeitstempels in lokaler Zeit („8:05"), oder null — auch dann
 * null, wenn der Zeitstempel nur einen TAG meint (siehe `hatUhrzeit`). */
export function uhrzeit(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || !hatUhrzeit(d)) return null;
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Das Zeitfenster einer Aufgabe: „8:00 – 17:45", „ab 8:00", „bis 17:45",
 * „fällig 12:00" — oder null, wenn keine Zeit bekannt ist.
 *
 * Ein Ende ohne Anfang bleibt „bis …": eine Anfangszeit zu erfinden (etwa den
 * Tagesbeginn) wäre eine Aussage, die niemand getroffen hat (Wurzel 4).
 */
export function zeitfenster(task: Terminiert): string | null {
  const von = uhrzeit(task.start_at);
  const bis = uhrzeit(task.end_at);
  if (von && bis) return von === bis ? von : `${von} – ${bis}`;
  if (von) return `ab ${von}`;
  if (bis) return `bis ${bis}`;
  const faellig = uhrzeit(task.due_at);
  return faellig ? `fällig ${faellig}` : null;
}

/**
 * Abgeschlossen — erledigt oder abgebrochen, also nichts mehr zu tun.
 *
 * EINE Quelle für „überfällig" und für die Punktmarker: `accepted` und
 * `in_progress` gelten als OFFEN, denn die Arbeit läuft noch.
 */
export function istAbgeschlossen(status: TaskStatus): boolean {
  return status === "done" || status === "cancelled";
}

/** Offen und der Tag liegt vor heute. */
export function istUeberfaellig(
  task: Pick<Task, "status" | "start_at" | "due_at">,
  heuteIso: string,
): boolean {
  if (istAbgeschlossen(task.status)) return false;
  const tag = aufgabenTag(task);
  return tag !== null && tag < heuteIso;
}

export type Tagesgruppe<T> = {
  /** Kalendertag der Gruppe, oder null für „ohne Termin". */
  iso: string | null;
  aufgaben: T[];
};

/**
 * Aufgaben nach Tag gruppieren, Tage aufsteigend, innerhalb des Tages nach
 * Startzeit. Aufgaben OHNE Termin kommen zuletzt in eine eigene Gruppe —
 * einsortieren nach „heute" würde ihnen ein Datum andichten.
 */
export function gruppiereNachTag<T extends Pick<Task, "start_at" | "due_at" | "title">>(
  aufgaben: T[],
): Tagesgruppe<T>[] {
  const nachTag = new Map<string, T[]>();
  const ohneTag: T[] = [];
  for (const a of aufgaben) {
    const tag = aufgabenTag(a);
    if (tag === null) {
      ohneTag.push(a);
      continue;
    }
    const liste = nachTag.get(tag);
    if (liste) liste.push(a);
    else nachTag.set(tag, [a]);
  }
  const gruppen: Tagesgruppe<T>[] = [...nachTag.keys()]
    .sort()
    .map((iso) => ({
      iso,
      aufgaben: [...(nachTag.get(iso) ?? [])].sort(vergleicheZeit),
    }));
  if (ohneTag.length > 0) gruppen.push({ iso: null, aufgaben: ohneTag });
  return gruppen;
}

function vergleicheZeit<T extends Pick<Task, "start_at" | "due_at" | "title">>(
  a: T,
  b: T,
): number {
  const za = a.start_at ?? a.due_at ?? "";
  const zb = b.start_at ?? b.due_at ?? "";
  return za === zb ? a.title.localeCompare(b.title, "de") : za.localeCompare(zb);
}

/**
 * Wie viele OFFENE Aufgaben je Tag — für die Punktmarker des Wochenstreifens.
 *
 * Der Punkt sagt „hier ist noch etwas zu tun". Gezählt wurde vorher unabhängig
 * vom Status: ein durchgearbeiteter Tag sah damit aus wie ein Tag mit offener
 * Arbeit, und unter allen sieben Tagen der Woche stand ein Punkt — der Streifen
 * sagte nichts mehr aus.
 */
export function zaehleProTag<
  T extends Pick<Task, "status" | "start_at" | "due_at" | "end_at">,
>(aufgaben: T[]): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const a of aufgaben) {
    if (istAbgeschlossen(a.status)) continue;
    // JEDER berührte Tag, nicht nur der Starttag: eine Aufgabe über zwei Tage
    // ist an beiden zu tun und muss an beiden einen Punkt tragen.
    for (const tag of aufgabenTage(a)) {
      zaehler.set(tag, (zaehler.get(tag) ?? 0) + 1);
    }
  }
  return zaehler;
}

/**
 * Die sieben Tage der Woche, in der `ankerIso` liegt — MONTAG zuerst.
 *
 * Montag, nicht Sonntag: der Wochenstreifen ist ein Arbeitsplan, und der
 * Monats-Kalender dieser App (`HostCalendar`) beginnt seinerseits sonntags,
 * weil das Referenz-Mockup es so vorgibt. Für die Aufgabenwoche zählt die
 * europäische Arbeitswoche.
 */
export function wochenTage(ankerIso: string): string[] {
  const anker = parseLocal(ankerIso);
  const versatz = (anker.getDay() + 6) % 7; // So=0 → 6, Mo=1 → 0
  const montag = new Date(anker);
  montag.setDate(montag.getDate() - versatz);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(montag);
    d.setDate(d.getDate() + i);
    return isoLocal(d);
  });
}

/** Kalendertag um `n` Tage verschoben (n darf negativ sein). */
export function tagPlus(iso: string, n: number): string {
  const d = parseLocal(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

const WOCHENTAGE_LANG = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
const MONATE_LANG = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Der Gruppenkopf über einem Tag: „Heute · Freitag, 21. August", sonst
 * „Freitag, 21. August". Das Jahr kommt dazu, sobald es nicht das laufende ist
 * — dieselbe Regel wie `tagKurz` (ohne Jahr liest sich 2027 wie heute).
 */
export function tagLabel(iso: string, heuteIso: string): string {
  const d = parseLocal(iso);
  const jahr = d.getFullYear();
  const basis = `${WOCHENTAGE_LANG[d.getDay()]}, ${d.getDate()}. ${MONATE_LANG[d.getMonth()]}`;
  const mitJahr = jahr === parseLocal(heuteIso).getFullYear() ? basis : `${basis} ${jahr}`;
  if (iso === heuteIso) return `Heute · ${mitJahr}`;
  if (iso === tagPlus(heuteIso, 1)) return `Morgen · ${mitJahr}`;
  return mitJahr;
}

/** „August 2026" — die Kopfzeile des Wochenstreifens. */
export function monatLabel(iso: string): string {
  const d = parseLocal(iso);
  return `${MONATE_LANG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Wie weit der Ladebereich über den Monat hinausreicht — der Wochenstreifen
 * greift höchstens sechs Tage in den Nachbarmonat. */
const RAND_TAGE = 7;

/**
 * Der Ladebereich für `GET /tasks/calendar` (`month_from`/`month_to`): der
 * Monat des Ankertags PLUS eine Woche Rand auf jeder Seite.
 *
 * Der Rand ist kein Vorrat, sondern Notwendigkeit. Der Wochenstreifen
 * (`wochenTage`) läuft über die Monatsgrenze — die Woche des 1. September
 * beginnt am 31. August. Geladen wurde aber nur der Monat des GEWÄHLTEN Tages:
 * die Nachbarmonats-Tage im selben Streifen standen ohne Punktmarker da und
 * ihre Aufgaben fehlten in der Tagesliste, bis man ausdrücklich dorthin
 * wechselte — dann fehlten umgekehrt die sechs Tage der anderen Seite.
 *
 * Der Rand deckt zugleich den Zeitzonen-Versatz ab: die Grenzen sind
 * UTC-Zeitpunkte, die Tageszuordnung in der Ansicht ist lokal (`aufgabenTag`).
 * Ohne Rand fiel eine Aufgabe am 1. um 01:00 Ortszeit (= letzter Tag 23:00
 * UTC) aus dem Fenster.
 */
export function monatsGrenzen(iso: string): { von: string; bis: string } {
  const d = parseLocal(iso);
  const von = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1 - RAND_TAGE));
  const bis = new Date(
    Date.UTC(d.getFullYear(), d.getMonth() + 1, RAND_TAGE, 23, 59, 59),
  );
  return { von: von.toISOString(), bis: bis.toISOString() };
}
