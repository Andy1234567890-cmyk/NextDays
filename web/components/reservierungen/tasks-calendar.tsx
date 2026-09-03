"use client";

// Aufgaben-Kalender (.. /tasks): Monats-Timeline als Gantt-Grid.
// Sticky Objektspalte links, feste Tages-Spalten, rote Heute-Linie, je Objekt
// Buchungs-Balken (aus reservations) + Aufgaben-Balken mit Status-Badge.
// Filterleiste (Monat ← →, Nutzer, Objekt, Alles zurücksetzen). Live via
// useRealtime auf tasks + reservations.
//
// VERSCHIEBEN PER DRAG & DROP (03.09.2026): eine offene Aufgabe lässt sich mit
// der Maus auf einen anderen Tag DERSELBEN Objektzeile ziehen. Verschoben wird
// um ganze Tage in der Ortszeit des Objekts — „08:00–11:00 am 23." wird zu
// „08:00–11:00 am 25.", auch über eine Zeitumstellung hinweg. Der Weg zum
// Server ist derselbe wie im Popover (`PATCH /zeitfenster`), deshalb zieht
// jede andere Ansicht (Team-Aufgaben, Meine Aufgaben, Buchungs-Zeitleiste) per
// Realtime auf `tasks` nach. Ein Wechsel der Objektzeile ist KEIN Ziel: die
// Aufgabe hängt an ihrer Buchung, und der Endpunkt kennt kein Objekt.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AufgabenFilter } from "@/components/reservierungen/aufgaben-filter";
import { BookingPopover } from "@/components/reservierungen/booking-popover";
import { FehlerHinweis } from "@/components/reservierungen/fehler-hinweis";
import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { TaskCreatePopup } from "@/components/reservierungen/task-create-popup";
import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { TaskPopover } from "@/components/reservierungen/task-popover";
import { CHANNEL_META } from "@/lib/calendar-channels";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import type { AvailabilitySource } from "@/lib/calendar";
import { mitarbeiterOptionen } from "@/lib/mitarbeiter-optionen";
import { UNASSIGNED } from "@/lib/aufgaben-konstanten";
import { channelLabelLoose } from "@/lib/channel-logos";
import { fehlerMelden } from "@/lib/fehler-melden";
import {
  type CalendarBooking,
  type CalendarRow,
  type TaskListItem,
  getTaskCalendar,
  listRules,
  listTaskAssignees,
  setTaskZeitfenster,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";
import {
  AufgabenKalenderDebug,
  type DebugZeile,
  type Verschiebung,
} from "./aufgaben-kalender-debug";

// MONTHS/WEEKDAYS werden pro Komponente aus t('tasksCalendar.months'/'weekdays')
// gebaut (ICU-Objekte lassen sich hier nicht modulweit mit useTranslations
// laden, da dies keine Komponente ist).

const COL = 6.5; // rem pro Tag-Spalte (Platz für volles Datum im Header)
const LABEL = 11; // rem der sticky Objektspalte
const ROW_MIN = 5.5; // rem Mindesthöhe je Objektzeile
const BOOKING_H = 2.6; // rem Höhe Buchungs-Balken (2-zeilig)
const TASK_H = 1.7; // rem Höhe Aufgaben-Balken (1-zeilig)
const LANE_GAP = 0.35; // rem Abstand zwischen Lanes
// Halbtags-Versatz wie im Multikalender (components/kalender): eine Buchung
// beginnt zur Anreise-Mittagszeit (halber Tag rein) und läuft bis zur Mitte
// des Abreisetags — so teilen sich Abreise-Gast und neuer Anreise-Gast
// optisch denselben Wechseltag (kein doppelt belegter Volltag).
const HALF_DAY = 0.5;

// Der Zeitstrahl waechst beim Scrollen an beiden Raendern um diesen Block.
// 30 Tage, weil das dem bisherigen Monatssprung entspricht: eine Pfeiltaste
// oder ein Scroll bis zum Rand foerdert etwa dieselbe Menge zutage wie frueher
// ein Monatswechsel.
const BLOCK_TAGE = 30;
// Wie nah am Rand nachgeladen wird (in Spalten). Grosszuegig genug, dass beim
// zuegigen Scrollen nie eine leere Flaeche auftaucht.
const RAND_SPALTEN = 10;
// Startfenster: so viele Tage vor und nach heute stehen beim Oeffnen bereit.
const START_ZURUECK = 15;
const START_VOR = 45;
// Obergrenze des geladenen Zeitstrahls. Er waechst beim Scrollen an beiden
// Raendern, und JEDES Nachladen holt den GESAMTEN Bereich neu (ein Aufruf,
// kein Stueckwerk) — ohne Deckel zoege ein langes Scrollen also immer
// groessere Abfragen nach sich, bis der Endpunkt in die Knie geht. Bei
// Erreichen der Grenze faellt am gegenueberliegenden Rand derselbe Block weg:
// das Fenster WANDERT dann, statt zu wachsen. 450 Tage sind gut ein Jahr in
// jede Richtung und decken jede Planung ab, die im Aufgabenkalender vorkommt.
const MAX_TAGE = 450;

const TAG_MS = 86_400_000;

/** Ein Datum um `n` Tage verschoben (UTC-Mitternacht). */
function tagPlus(basis: Date, n: number): Date {
  return new Date(basis.getTime() + n * TAG_MS);
}

/** Ganze Tage zwischen zwei UTC-Mitternachten. */
function tageZwischen(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / TAG_MS);
}

/** UTC-Mitternacht des heutigen Tages — Ankerpunkt des Zeitstrahls. */
function heuteUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

// ..-Farbcodes für Aufgaben (aus dem Lernen-Text):
//   ROT   = offen und niemandem zugewiesen (kann nicht erledigt werden)
//   GELB  = heute fällig
//   GRÜN  = abgeschlossen
//   WEISS = offen, zugewiesen, keine Warnung
// (HELLBLAU „einer Rolle zugewiesen" existiert bei uns nicht — keine Rollen-
// Zuweisung von Aufgaben, nur konkrete Mitarbeiter.)
type TaskStyle = { bg: string; border: string; text: string; icon: string };

function taskStyle(t: TaskListItem, todayKey: string): TaskStyle {
  if (t.status === "done") {
    return {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: "ph:check-circle",
    };
  }
  if (t.status === "cancelled") {
    return {
      bg: "bg-muted",
      border: "border-border",
      text: "text-muted-foreground line-through",
      icon: "ph:x-circle",
    };
  }
  const dueKey = (t.start_at ?? t.due_at)?.slice(0, 10);
  if (dueKey === todayKey) {
    return {
      bg: "bg-amber-500/10",
      border: "border-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      icon: "ph:warning",
    };
  }
  if (!t.assignee_id) {
    return {
      bg: "bg-rose-500/10",
      border: "border-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      icon: "ph:warning-circle",
    };
  }
  // WEISS: offen, zugewiesen, keine Warnung.
  return {
    bg: "bg-card",
    border: "border-border",
    text: "text-foreground",
    icon: "ph:circle",
  };
}

function channelMeta(b: CalendarBooking) {
  const key = b.channel as AvailabilitySource;
  return CHANNEL_META[key] ?? CHANNEL_META.direct;
}

// „13. Juli 2026 – 19. Juli 2026" in der Sprache der Oberfläche.
function bookingRange(b: CalendarBooking, locale: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  return `${fmt(b.check_in)} – ${fmt(b.check_out)}`;
}

// Verteilt Segmente {start,end} auf Lanes, sodass sich in einer Lane keine
// zwei Segmente überlappen (greedy). Ergebnis: Array von Lanes, jede eine
// nicht-überlappende Segmentliste — so stapeln Balken sauber untereinander.
type Seg<T> = { id: string; start: number; end: number; data: T };
function packLanes<T>(segs: Seg<T>[]): Seg<T>[][] {
  const sorted = [...segs].sort((a, b) => a.start - b.start || a.end - b.end);
  const lanes: Seg<T>[][] = [];
  for (const seg of sorted) {
    const lane = lanes.find((l) => l[l.length - 1].end <= seg.start);
    if (lane) lane.push(seg);
    else lanes.push([seg]);
  }
  return lanes;
}

/**
 * Welche HÄLFTE des Tages eine Aufgabe belegt — als Bruchteil einer Spalte.
 *
 * Der Wechseltag trägt beides: der abreisende Gast wird vormittags
 * ausgecheckt und gereinigt, der anreisende kommt nachmittags. Als zwei
 * Ganztags-Chips stapeln sich diese Aufgaben untereinander und der Tag wirkt
 * doppelt belegt — genau so, wie es beim Buchungsbalken schon per `HALF_DAY`
 * gelöst ist.
 *
 * Die Hälfte kommt aus der UHRZEIT der Aufgabe, nicht aus ihrem Auslöser: eine
 * Regel „Am Anreisetag 08:00–11:00" gehört in den Vormittag, auch wenn sie am
 * Anreisetag hängt. Liegt die Aufgabe über Mittag oder trägt sie gar keine
 * Uhrzeit (Tagesbeginn 00:00 auf beiden Seiten), bleibt sie ganztags — eine
 * Hälfte zu raten wäre eine Aussage über eine Zeit, die niemand gepflegt hat.
 */
function minutenInZone(iso: string, zone: string | null): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const teile = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const h = teile.find((p) => p.type === "hour")?.value;
    const m = teile.find((p) => p.type === "minute")?.value;
    if (h === undefined || m === undefined) return null;
    // `en-GB` gibt Mitternacht als „24" aus, nicht als „00".
    return (Number(h) % 24) * 60 + Number(m);
  } catch {
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

function tagesHaelfte(
  startIso: string | null,
  endIso: string | null,
  zone: string | null = null,
): { versatz: number; breite: number } {
  const GANZ = { versatz: 0, breite: 1 };
  if (!startIso) return GANZ;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  // Über mehrere Tage: keine Hälfte, das wäre eine Verkürzung.
  if (end && end.getTime() - start.getTime() > 86_400_000) return GANZ;
  // Uhrzeit in der ZEITZONE DES OBJEKTS (03.09.2026). „Am Anreisetag
  // 08:00–11:00" ist eine an der Regel gepflegte ORTSzeit, die `engine.py`
  // durch die Objekt-Zone nach UTC rechnet; die Rückrechnung muss durch
  // dieselbe Zone laufen. Vorher stand hier `getUTCHours` (13:00 Ortszeit galt
  // als 11:00 = Vormittag) und kurzzeitig `getHours` — letzteres machte die
  // Tageshälfte vom Standort des BEDIENERS abhängig: dieselbe Aufgabe erschien
  // in Auckland vormittags und in Kopenhagen nachmittags.
  const startMin = minutenInZone(startIso, zone);
  if (startMin === null) return GANZ;
  const endMin = endIso ? minutenInZone(endIso, zone) ?? startMin : startMin;
  const MITTAG = 12 * 60;
  if (end && endMin > startMin && endMin <= MITTAG) {
    return { versatz: 0, breite: HALF_DAY };
  }
  if (startMin >= MITTAG) return { versatz: HALF_DAY, breite: HALF_DAY };
  return GANZ;
}

/** Kalendertag eines Wertes in EINER festen Zeitzone, als `YYYY-MM-DD`.
 *
 * DIE ZONE IST DIE DES OBJEKTS, nicht die des Bedieners (03.09.2026).
 * `start_at`/`due_at` sind UTC-Zeitstempel, deren Kalendertag serverseitig in
 * der Objekt-Zeitzone festgelegt wurde (`engine.py::_at`: `datetime.combine(
 * tag, uhr, tzinfo=zone).astimezone(UTC)`). Wer den Tag im Browser mit
 * `getDate()` zurückrechnet, liest die Zone des BEDIENERS: eine Agentur in
 * Kopenhagen sähe die Aufgaben eines Objekts auf Teneriffa um eine Spalte
 * verschoben — und zwar nur die, deren Uhrzeit die Mitternachtsgrenze
 * überschreitet, was wie ein Zufallsfehler aussieht.
 *
 * Fehlt die Zone am Objekt, gilt UTC — dieselbe Auskunft, die `_at`
 * serverseitig gibt. Ein geratener Ortswert wäre hier ein erfundener
 * Fallback (Wurzel 4).
 *
 * Reine Datumswerte (`2026-09-10`, so kommen `check_in`/`check_out`) tragen
 * keine Uhrzeit und damit keinen Zonenbezug; sie werden direkt aus der
 * Zeichenkette gelesen, statt durch eine Zeitzone geschickt zu werden.
 */
function tagInZone(iso: string, zone: string | null): string {
  const nurDatum = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  if (nurDatum) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // `en-CA` liefert ISO-Reihenfolge (YYYY-MM-DD) — die einzige Locale-Angabe,
  // die hier eine Zusage ist und keine Annahme.
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    // Unbekannte Zonenkennung (Datenfehler am Objekt): UTC statt Absturz.
    return d.toISOString().slice(0, 10);
  }
}

/** Spaltenindex eines Kalendertags im Zeitstrahl; clammt an den Rand.
 *
 * Beide Seiten sind reine Tageszahlen, deshalb kann hier keine Zeitzone mehr
 * kippen: `firstDay` ist eine UTC-Mitternacht (`heuteUtc`), der Tag kommt als
 * `YYYY-MM-DD` aus `tagInZone`.
 */
function spalteVonTag(tag: string, firstDay: Date, days: number): number {
  const [j, m, t] = tag.split("-").map(Number);
  const diff = Math.round((Date.UTC(j, m - 1, t) - firstDay.getTime()) / 86_400_000);
  return Math.max(0, Math.min(days, diff));
}

function dayIndex(
  iso: string,
  firstDay: Date,
  days: number,
  zone: string | null = null,
): number {
  return spalteVonTag(tagInZone(iso, zone), firstDay, days);
}

/** UTC-Mitternacht eines `YYYY-MM-DD`. */
function utcMitternacht(tag: string): Date {
  const [j, m, t] = tag.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t));
}

/**
 * Der UTC-Zeitpunkt, der in `zone` genau `tag` um `minuten` (seit 00:00) ist.
 *
 * Der Zonenversatz wird am ZIEL gemessen, nicht an der Quelle: eine Aufgabe
 * um 08:00 Ortszeit, die über den Tag der Zeitumstellung hinweg verschoben
 * wird, liegt danach weiter um 08:00 — nicht um 07:00 oder 09:00, wie es
 * `+ n × 24 h` in UTC ergäbe. Zwei Näherungsschritte, weil der Versatz am
 * ersten geratenen Zeitpunkt noch der falsche sein kann (Umstellungsnacht).
 */
function utcFuerOrtszeit(tag: string, minuten: number, zone: string | null): Date {
  const [j, m, t] = tag.split("-").map(Number);
  const wunsch = Date.UTC(j, m - 1, t, Math.floor(minuten / 60), minuten % 60);
  let ergebnis = wunsch;
  for (let i = 0; i < 2; i += 1) {
    const iso = new Date(ergebnis).toISOString();
    const [dj, dm, dt] = tagInZone(iso, zone).split("-").map(Number);
    const dortMin = minutenInZone(iso, zone) ?? 0;
    const dort = Date.UTC(dj, dm - 1, dt, Math.floor(dortMin / 60), dortMin % 60);
    ergebnis += wunsch - dort;
  }
  return new Date(ergebnis);
}

/** Einen Zeitstempel um `deltaTage` Kalendertage verschieben — die Uhrzeit
 *  in der Objekt-Zone bleibt. `null`, wenn der Wert kein Datum ist. */
function umTageVerschieben(
  iso: string,
  deltaTage: number,
  zone: string | null,
): string | null {
  const minuten = minutenInZone(iso, zone);
  if (minuten === null) return null;
  const zielTag = tagPlus(utcMitternacht(tagInZone(iso, zone)), deltaTage)
    .toISOString()
    .slice(0, 10);
  return utcFuerOrtszeit(zielTag, minuten, zone).toISOString();
}

/** Nur offene Aufgaben mit einem Datum lassen sich ziehen. Eine erledigte
 *  oder stornierte Aufgabe hat stattgefunden bzw. findet nicht statt — ihr
 *  Termin ist Protokoll, keine Planung. */
function verschiebbar(t: TaskListItem): boolean {
  return (
    t.status !== "done" &&
    t.status !== "cancelled" &&
    Boolean(t.start_at ?? t.due_at)
  );
}

export function TasksCalendar() {
  const t = useTranslations("reservations");
  const { channelLabel } = useCalendarLabels();
  const locale = useLocale();
  const MONTHS = t.raw("tasksCalendar.months") as string[];
  const WEEKDAYS = t.raw("tasksCalendar.weekdays") as string[];
  const now = new Date();
  // Durchgehender Zeitstrahl statt eines Monatsfensters.
  //
  // WARUM DER UMBAU: Der Kalender zeigte GENAU einen Monat; die Pfeile
  // sprangen zum naechsten. Eine Reinigung am 31. und die Anreise am 1. lagen
  // damit in zwei Ansichten, zwischen denen man hin- und herklicken musste —
  // gerade an den Monatsraendern, wo die meisten Wechsel liegen. Gemeldet als
  // „Es waere gut wenn der Aufgabenkalender endlos vor und zurueck scrollbar
  // nach links und rechts geht".
  //
  // `anker` ist der Tag an Spaltenindex 0. Er WANDERT nach links, wenn vorne
  // nachgeladen wird — dann waechst `tage` um denselben Betrag, damit rechts
  // nichts verlorengeht. Die Scrollposition wird beim Vorne-Anbau um die neue
  // Breite korrigiert, sonst springt der Blick.
  const [anker, setAnker] = useState(() => tagPlus(heuteUtc(), -START_ZURUECK));
  const [tage, setTage] = useState(START_ZURUECK + START_VOR);
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Ladefehler (z. B. 403) sichtbar machen statt still leeren Kalender zeigen
  // (Wurzel 5).
  const [loadError, setLoadError] = useState<string | null>(null);
  // Die Request-ID der fehlgeschlagenen Antwort. Ohne sie zeigt die
  // Oberflaeche nur „internal_error" — mit ihr holt `FehlerHinweis` die
  // hinterlegte Ursache (Exception-Typ + Codezeile) beim Server ab.
  const [loadRequestId, setLoadRequestId] = useState<string | undefined>();
  // Popovers: geklickte Aufgabe / Buchung (null = zu).
  const [taskPop, setTaskPop] = useState<TaskListItem | null>(null);
  const [bookingPop, setBookingPop] = useState<CalendarBooking | null>(null);
  // Foto-Modal (Checklist-Uploads) für eine Aufgabe.
  const [photoTaskId, setPhotoTaskId] = useState<string | null>(null);
  // „+"-Anlegen: geklickte Zelle (Objekt + Tag). null = zu.
  const [createCell, setCreateCell] = useState<{
    propertyId: string | null;
    reservationId?: string | null;
    date: string;
  } | null>(null);
  // Debug-Raster: legt ein Messgitter über die Zeitachse — Spaltennummer,
  // Datum und die Kante jedes Tages. Ohne es ist nicht ablesbar, auf welchem
  // TAG eine Pille sitzt, und genau das war die offene Frage (03.09.2026).
  const [debugRaster, setDebugRaster] = useState(false);
  // Drag & Drop: die gezogene Aufgabe samt ihrer Zeile und die Zelle, über
  // der sie gerade schwebt. Die Zeile steckt mit drin, damit eine fremde
  // Zeile den Drop gar nicht erst annimmt (kein `preventDefault` → der
  // Browser zeigt „nicht erlaubt").
  const [dragAufgabe, setDragAufgabe] = useState<{
    id: string;
    zeile: string;
  } | null>(null);
  // Dieselbe Information als Ref, SYNCHRON in `dragstart` gesetzt.
  //
  // WARUM ZWEI: Chrome bricht einen Drag ab, wenn sich das gezogene Element
  // im selben Tick wie `dragstart` verändert — der State-Update rendert die
  // Pille sofort neu (Klasse `opacity-40`), Chrome sieht ein anderes Element
  // unter der Maus und feuert `dragend`, bevor der Zeiger sich bewegt hat.
  // Gemessen am 03.09.2026 per CDP: 3× dragstart, 3× dragend, kein einziges
  // dragover; ein nacktes Probe-Div daneben zog einwandfrei. Der State darf
  // deshalb erst im NÄCHSTEN Tick gesetzt werden (`setTimeout 0`) — die
  // Zellen brauchen die Zeile aber schon beim ersten `dragover`, und dafür
  // steht sie hier.
  const dragRef = useRef<{ id: string; zeile: string } | null>(null);
  const [dropZiel, setDropZiel] = useState<{
    zeile: string;
    tag: string;
  } | null>(null);
  // Protokoll aller Verschiebungen dieser Sitzung fürs Diagnose-Panel: was
  // vorher stand, was gesendet wurde, was der Server sagte.
  const [verschiebungen, setVerschiebungen] = useState<Verschiebung[]>([]);
  const [users, setUsers] = useState<{ value: string; label: string }[]>([]);
  const [rules, setRules] = useState<{ value: string; label: string }[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [propFilter, setPropFilter] = useState<string[]>([]);
  const [ruleFilter, setRuleFilter] = useState<string[]>([]);

  const firstDay = anker;
  const days = tage;
  const from = useMemo(() => anker.toISOString(), [anker]);
  const to = useMemo(
    () =>
      new Date(tagPlus(anker, tage - 1).getTime() + 86_399_000).toISOString(),
    [anker, tage],
  );

  // Scroll-Kasten: haelt die Position beim Vorne-Anbau und meldet die Raender.
  const scrollBox = useRef<HTMLDivElement | null>(null);
  // Breite, die beim naechsten Rendern vorne dazugekommen ist — der Effekt
  // unten schiebt den Scroll darum weiter. OHNE das springt der Blick beim
  // Nachladen nach links, weil derselbe Tag ploetzlich weiter rechts liegt.
  const vorneDazu = useRef(0);
  // Waehrend eines Nachladens nicht erneut ausloesen: der Zustand aendert sich
  // erst im naechsten Rendern, bis dahin meldet der Scroll-Handler weiter
  // „am Rand" und wuerde in einem Rutsch durchladen.
  const laedtRand = useRef(false);

  // `stillLaden` wie in `team-tasks`: ein Realtime-Ereignis tauscht die
  // Balken aus, ohne die ganze Timeline durch einen Ladezustand zu ersetzen.
  // Sonst baut sich der Monat bei jeder fremden Statusmeldung neu auf.
  const load = useCallback(
    async (stillLaden = false) => {
      if (!stillLaden) setLoading(true);
      // Mehrfachauswahl wirkt wirklich: vorher wurde der Nutzerfilter nur bei
      // GENAU einer Auswahl an den Server gegeben, jede weitere blieb folgenlos.
      const res = await getTaskCalendar(from, to, {
        assignee_ids: userFilter,
        rule_ids: ruleFilter,
      });
      if (res.ok) {
        setRows(res.data.rows);
        setLoadError(null);
        setLoadRequestId(undefined);
      } else {
        // Fehler NIE verschlucken: sonst wirkt der Aufgaben-Kalender „kaputt".
        setLoadError(res.error);
        setLoadRequestId(res.requestId);
        setRows([]);
      }
      setLoading(false);
    },
    [from, to, userFilter, ruleFilter],
  );

  const stillNachladen = useCallback(() => {
    void load(true);
  }, [load]);

  /**
   * Eine Aufgabe auf einen anderen Kalendertag legen.
   *
   * Gerechnet wird der Tagesabstand zwischen dem Tag der Aufgabe (in der
   * Objekt-Zone, wie er gezeichnet wird) und der Zielzelle; Start und Ende
   * wandern um genau diesen Abstand, die Uhrzeit bleibt. Der Server zieht
   * `due_at` nach (Wurzel 1, siehe `set_zeitfenster`).
   *
   * Aufgaben ohne `start_at` (Altbestand, nur `due_at`) bekommen den
   * verschobenen Wert als START: jeder Schreibpfad setzt seit dem 03.09.2026
   * ein Fenster, und aus einem Ende einen Anfang zu erfinden wäre hier
   * ebenso falsch wie ein Ende aus dem Nichts — der Start ist die Angabe,
   * die die Zeitachse zeichnet.
   *
   * Optimistisch: die Pille springt sofort, der Server bestätigt oder die
   * Zeile wird neu geladen. Kein Rücksprung aus einem Schnappschuss, weil
   * inzwischen ein Realtime-Ereignis andere Aufgaben verändert haben kann.
   */
  const aufgabeVerschieben = useCallback(
    async (aufgabe: TaskListItem, zone: string | null, zielTag: string) => {
      const iso = aufgabe.start_at ?? aufgabe.due_at;
      if (!iso) return;
      const vonTag = tagInZone(iso, zone);
      const delta = tageZwischen(utcMitternacht(vonTag), utcMitternacht(zielTag));
      if (delta === 0) return;
      const neuStart = umTageVerschieben(iso, delta, zone);
      const neuEnde =
        aufgabe.start_at && aufgabe.end_at
          ? umTageVerschieben(aufgabe.end_at, delta, zone)
          : null;
      if (!neuStart) return;

      setRows((alt) =>
        alt.map((r) => ({
          ...r,
          tasks: r.tasks.map((x) =>
            x.id === aufgabe.id
              ? { ...x, start_at: neuStart, end_at: neuEnde, due_at: neuEnde ?? neuStart }
              : x,
          ),
        })),
      );

      const eintrag: Verschiebung = {
        zeit: new Date().toISOString(),
        titel: aufgabe.title,
        zone,
        von: vonTag,
        nach: zielTag,
        delta,
        startVorher: aufgabe.start_at,
        endeVorher: aufgabe.end_at,
        dueVorher: aufgabe.due_at,
        startGesendet: neuStart,
        endeGesendet: neuEnde,
        ergebnis: "offen",
      };
      setVerschiebungen((v) => [eintrag, ...v].slice(0, 50));

      const res = await setTaskZeitfenster(aufgabe.id, neuStart, neuEnde);
      const ergebnis = res.ok ? "ok" : res.error;
      setVerschiebungen((v) =>
        v.map((e) =>
          e === eintrag
            ? {
                ...e,
                ergebnis,
                startServer: res.ok ? res.data.start_at : undefined,
                endeServer: res.ok ? res.data.end_at : undefined,
              }
            : e,
        ),
      );
      if (res.ok) {
        toast.success(
          t("tasksCalendar.dragMoved", {
            title: aufgabe.title,
            date: utcMitternacht(zielTag).toLocaleDateString(locale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          }),
        );
      } else {
        fehlerMelden(res);
      }
      // Auch bei Erfolg neu laden: Realtime meldet sich zwar, aber die
      // Pille soll den SERVER-Stand zeigen, nicht die eigene Vorwegnahme.
      stillNachladen();
    },
    [locale, stillNachladen, t],
  );

  // Erstlast MIT Ladezustand, jedes Nachwachsen des Zeitstrahls OHNE.
  //
  // WARUM: `load` haengt an `from`/`to`, und die aendern sich bei jedem
  // Rand-Nachladen. Mit dem Ladezustand verschwaende die ganze Timeline bei
  // jedem Scroll-Ende fuer einen Moment und baute sich neu auf — waehrend der
  // Nutzer gerade scrollt. Die Erstlast braucht ihn, das Nachwachsen nicht:
  // dort stehen die vorhandenen Zeilen schon da und werden nur ergaenzt.
  const ersteLast = useRef(true);
  useEffect(() => {
    void load(!ersteLast.current);
    ersteLast.current = false;
  }, [load]);

  useEffect(() => {
    void (async () => {
      const [tenantUsers, autoRules] = await Promise.all([
        listTaskAssignees(),
        listRules("auto"),
      ]);
      if (tenantUsers.ok) {
        setUsers([
          ...mitarbeiterOptionen(tenantUsers.data),
          { value: UNASSIGNED, label: t("aufgabenFilter.unassignedOption") },
        ]);
      }
      if (autoRules.ok) {
        setRules(autoRules.data.map((r) => ({ value: r.id, label: r.name })));
      }
    })();
  }, [t]);

  // `stillNachladen` statt `load`: `onChange` reicht das Ereignis als Argument
  // durch — `onChange: load` machte daraus das `stillLaden`-Flag. Das wäre
  // hier zwar zufällig richtig, aber aus dem falschen Grund.
  useRealtime({ table: "tasks", onChange: stillNachladen });
  useRealtime({ table: "reservations", onChange: stillNachladen });

  // Der linkeste sichtbare Tag. Er speist die Monatsanzeige in der Kopfzeile
  // (frueher stand dort der fest gewaehlte Monat) und ist der Bezugspunkt der
  // Pfeiltasten. Aus dem SCROLL abgeleitet, nicht aus dem Anker: der Anker ist
  // der Anfang des geladenen Bereichs und liegt beim Scrollen weit links
  // ausserhalb des Bildes.
  const [linkerIndex, setLinkerIndex] = useState(0);
  const sichtbarerTag = useMemo(
    () =>
      tagPlus(anker, Math.min(Math.max(0, linkerIndex), Math.max(0, tage - 1))),
    [anker, linkerIndex, tage],
  );

  // Rem in Pixel — die Spaltenbreite steht in rem, der Scroll rechnet in px.
  const remPx = useMemo(() => {
    if (typeof window === "undefined") return 16;
    return (
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    );
  }, []);

  /** Vorne (Vergangenheit) einen Block anbauen. */
  const vorneWachsen = useCallback(() => {
    if (laedtRand.current) return;
    laedtRand.current = true;
    vorneDazu.current = BLOCK_TAGE * COL * remPx;
    setAnker((a) => tagPlus(a, -BLOCK_TAGE));
    // Am Deckel hinten abschneiden statt weiter zu wachsen.
    setTage((n) => Math.min(n + BLOCK_TAGE, MAX_TAGE));
  }, [remPx]);

  /** Hinten (Zukunft) einen Block anbauen. Der Anker bleibt, nur die Laenge
   *  waechst — deshalb ist hier keine Scroll-Korrektur noetig. */
  const hintenWachsen = useCallback(() => {
    if (laedtRand.current) return;
    laedtRand.current = true;
    if (tage + BLOCK_TAGE <= MAX_TAGE) {
      setTage(tage + BLOCK_TAGE);
      return;
    }
    // Deckel erreicht: vorne denselben Block abwerfen, damit die Laenge gleich
    // bleibt (das Fenster WANDERT). Die Scrollposition wird dann nach LINKS
    // korrigiert — negativ, weil derselbe Tag nun weiter links liegt.
    //
    // Beide Zustaende werden HIER gesetzt, nicht ineinander verschachtelt: ein
    // `setAnker` im Updater von `setTage` laeuft im Rendern und ist damit
    // weder zuverlaessig noch nachvollziehbar.
    vorneDazu.current = -BLOCK_TAGE * COL * remPx;
    setAnker((a) => tagPlus(a, BLOCK_TAGE));
    // `tage` bleibt unveraendert — aber der Layout-Effekt muss trotzdem
    // laufen, und der haengt an `anker`, der sich gerade aendert.
  }, [remPx, tage]);

  // Scrollposition nach einem Vorne-Anbau korrigieren, BEVOR der Browser
  // zeichnet (`useLayoutEffect`): mit `useEffect` sieht man ein Bild lang den
  // Sprung. Danach ist der Rand wieder freigegeben.
  useLayoutEffect(() => {
    const box = scrollBox.current;
    if (box && vorneDazu.current !== 0) {
      box.scrollLeft += vorneDazu.current;
      vorneDazu.current = 0;
    }
    laedtRand.current = false;
  }, [anker, tage]);

  /** Am Rand nachladen. Die Schwelle ist in SPALTEN gerechnet, nicht in
   *  Pixeln — sonst haengt das Verhalten an der Bildschirmbreite. */
  const beimScrollen = useCallback(() => {
    const box = scrollBox.current;
    if (!box) return;
    setLinkerIndex(Math.round(box.scrollLeft / (COL * remPx)));
    if (laedtRand.current) return;
    const schwelle = RAND_SPALTEN * COL * remPx;
    if (box.scrollLeft < schwelle) {
      vorneWachsen();
      return;
    }
    if (box.scrollLeft + box.clientWidth > box.scrollWidth - schwelle) {
      hintenWachsen();
    }
  }, [remPx, vorneWachsen, hintenWachsen]);

  /** Zu einem Datum springen. Liegt es ausserhalb des geladenen Bereichs,
   *  wird der Zeitstrahl darum herum neu aufgespannt — sonst zeigte der
   *  Sprung ins Leere. */
  const springeZu = useCallback(
    (ziel: Date) => {
      const idx = tageZwischen(anker, ziel);
      if (idx < 0 || idx >= tage) {
        setAnker(tagPlus(ziel, -START_ZURUECK));
        setTage(START_ZURUECK + START_VOR);
        // Nach dem Neuaufbau steht das Ziel an Index START_ZURUECK.
        requestAnimationFrame(() => {
          const box = scrollBox.current;
          if (box) box.scrollLeft = START_ZURUECK * COL * remPx;
        });
        return;
      }
      const box = scrollBox.current;
      if (box) {
        box.scrollTo({ left: idx * COL * remPx, behavior: "smooth" });
      }
    },
    [anker, tage, remPx],
  );

  /** Pfeiltasten: um einen Block weiter, nicht mehr um einen Monat. */
  const shift = (blocks: number) => {
    springeZu(tagPlus(sichtbarerTag, blocks * BLOCK_TAGE));
  };

  const propOptions = useMemo(
    () =>
      rows
        .filter((r) => r.property_id)
        .map((r) => ({
          value: r.property_id as string,
          label: r.property_title,
        })),
    [rows],
  );

  const visibleRows = useMemo(() => {
    if (propFilter.length === 0) return rows;
    return rows.filter(
      (r) => r.property_id === null || propFilter.includes(r.property_id),
    );
  }, [rows, propFilter]);

  /** Diagnose-Zeilen: dieselbe Rechnung wie beim Zeichnen, aber als eigener
   *  Wert statt als Seiteneffekt im Render. Sie beantworten die Frage, die
   *  sich aus der Position allein NICHT beantworten lässt: kommt der Tag aus
   *  `start_at` oder aus `due_at`, in welcher Zone wurde er gerechnet, und
   *  liegt er im Zeitraum seiner Buchung. */
  const debugZeilen = useMemo<DebugZeile[]>(() => {
    const out: DebugZeile[] = [];
    for (const row of visibleRows) {
      const zone = row.timezone ?? null;
      for (const t of row.tasks) {
        const iso = t.start_at ?? t.due_at;
        out.push({
          objekt: row.property_title || "(ohne Objekt)",
          zone,
          aufgabe: t,
          quelle: t.start_at ? "start_at" : t.due_at ? "due_at" : "keins",
          tag: iso ? tagInZone(iso, zone) : null,
          endTag: t.end_at ? tagInZone(t.end_at, zone) : null,
          spalte: iso ? dayIndex(iso, firstDay, days, zone) : 0,
          buchung: row.bookings.find((b) => b.id === t.reservation_id) ?? null,
        });
      }
    }
    return out;
  }, [visibleRows, firstDay, days]);

  // Heute-Linie: Index im Zeitstrahl, oder null wenn heute ausserhalb des
  // geladenen Bereichs liegt (weit in die Vergangenheit gescrollt).
  const todayIdx = useMemo(() => {
    const i = tageZwischen(firstDay, heuteUtc());
    return i >= 0 && i < days ? i : null;
  }, [firstDay, days]);

  const gridWidth = `${LABEL + days * COL}rem`;
  const pad = (n: number) => String(n).padStart(2, "0");
  /** Ein Tag des Zeitstrahls als ISO-Datum (yyyy-mm-dd). */
  const tagKey = useCallback(
    (i: number) => {
      const d = tagPlus(firstDay, i);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    },
    [firstDay],
  );
  // Raender des GELADENEN Bereichs für die Halbtags-Erkennung: ein Balken, der
  // ueber den Rand hinausreicht, wird dort gerade abgeschnitten statt mit einer
  // halben Spitze zu enden, die es nicht gibt.
  const firstDayKey = tagKey(0);
  const lastDayKey = tagKey(days - 1);
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("tasksCalendar.breadcrumbHome")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">
          {t("tasksCalendar.breadcrumbTasks")}
        </span>
      </nav>

      {loadError && (
        <FehlerHinweis fehler={loadError} requestId={loadRequestId} />
      )}

      {/* Titel + Lernen + Filterleiste */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">
            {t("tasksCalendar.title")}
          </h1>
          <LearnButton title={t("tasksCalendar.title")}>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>{t("tasksCalendar.learn.intro")}</p>
              <div>
                <p className="mb-1 font-medium text-foreground">
                  {t("tasksCalendar.learn.colorCodesTitle")}
                </p>
                <ul className="flex flex-col gap-1">
                  <li>
                    <b className="text-rose-600">
                      {t("tasksCalendar.learn.colorRedLabel")}
                    </b>{" "}
                    {t("tasksCalendar.learn.colorRedText")}
                  </li>
                  <li>
                    <b className="text-amber-600">
                      {t("tasksCalendar.learn.colorYellowLabel")}
                    </b>{" "}
                    {t("tasksCalendar.learn.colorYellowText")}
                  </li>
                  <li>
                    <b className="text-sky-600">
                      {t("tasksCalendar.learn.colorBlueLabel")}
                    </b>{" "}
                    {t("tasksCalendar.learn.colorBlueText")}
                  </li>
                  <li>
                    <b className="text-emerald-600">
                      {t("tasksCalendar.learn.colorGreenLabel")}
                    </b>{" "}
                    {t("tasksCalendar.learn.colorGreenText")}
                  </li>
                  <li>
                    <b>{t("tasksCalendar.learn.colorWhiteLabel")}</b>{" "}
                    {t("tasksCalendar.learn.colorWhiteText")}
                  </li>
                </ul>
              </div>
              <p>{t("tasksCalendar.learn.manualCreate")}</p>
              <p>
                {t.rich("tasksCalendar.learn.cellCreate", {
                  plus: () => <b>+</b>,
                })}
              </p>
              <p>{t("tasksCalendar.learn.scheduledInfo")}</p>
              <p>{t("tasksCalendar.learn.dragMove")}</p>
            </div>
          </LearnButton>
        </div>

        {/* NUR die Filter stehen neben dem Titel. Die Monatsnavigation ist im
            selben Zug (31.08.2026) hier heraus und direkt über den Kalender
            gewandert: sie steuert das Raster, nicht die Datenauswahl. Beides
            nebeneinander, jedes mit eigener Kleinüberschrift, ergab die Zeile
            aus acht ungleichen Elementen, die als „durcheinander" gemeldet
            wurde. */}
        <div className="flex flex-wrap items-center gap-2">
          <AufgabenFilter
            zusatzReset={() => springeZu(heuteUtc())}
            filters={[
              {
                key: "rule",
                caption: t("aufgabenFilter.taskCaption"),
                allLabel: t("aufgabenFilter.allTasks"),
                dialogTitle: t("aufgabenFilter.taskDialog"),
                searchPlaceholder: t("aufgabenFilter.taskSearch"),
                options: rules,
                selected: ruleFilter,
                onChange: setRuleFilter,
              },
              {
                key: "user",
                caption: t("aufgabenFilter.usersCaption"),
                allLabel: t("aufgabenFilter.allUsers"),
                dialogTitle: t("aufgabenFilter.usersDialog"),
                searchPlaceholder: t("aufgabenFilter.usersSearch"),
                options: users,
                selected: userFilter,
                onChange: setUserFilter,
              },
              {
                key: "property",
                caption: t("aufgabenFilter.propertiesCaption"),
                allLabel: t("aufgabenFilter.allProperties"),
                dialogTitle: t("aufgabenFilter.propertiesDialog"),
                searchPlaceholder: t("aufgabenFilter.propertiesSearch"),
                options: propOptions,
                selected: propFilter,
                onChange: setPropFilter,
              },
            ]}
          />
        </div>
      </div>

      {/* Zeitsteuerung: unmittelbar über dem Raster, das sie bewegt. „Heute"
          steht als eigener Knopf daneben — er war vorher nur als Nebenwirkung
          des Filter-Zurücksetzens erreichbar, was niemand vermutet. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="flex size-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-muted"
          aria-label={t("tasksCalendar.previousMonth")}
        >
          <Icon icon="ph:arrow-left" className="size-4" />
        </button>
        {/* Zeigt den linkesten SICHTBAREN Tag, nicht einen fest gewählten
            Monat — beim durchgehenden Scrollen wandert die Beschriftung mit. */}
        <span className="min-w-32 rounded-full bg-secondary px-4 py-2 text-center text-sm font-semibold">
          {MONTHS[sichtbarerTag.getUTCMonth()]} {sichtbarerTag.getUTCFullYear()}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="flex size-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-muted"
          aria-label={t("tasksCalendar.nextMonth")}
        >
          <Icon icon="ph:arrow-right" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => springeZu(heuteUtc())}
          className="ml-1 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("tasksCalendar.today")}
        </button>
      </div>

      {/* Grid.
          EIGENER Scrollkasten mit fester Höhe, waagerecht UND senkrecht.
          WARUM: Bis zum 31.08.2026 stand hier nur `overflow-x-auto` ohne
          Höhengrenze. Der Kasten wuchs damit mit der Zahl der Objekte, und die
          waagerechte Scrollbar klebte an seinem unteren Ende — bei einem
          Betrieb mit einem Dutzend Objekten also weit unterhalb des
          Bildschirms. Gemeldet als „im Kalender kann ich nicht den Kalender
          weiter nach links oder rechts schieben, da der Schieber unten hängt".
          Man musste erst durch alle Objekte nach unten scrollen, um überhaupt
          an den Regler zu kommen, und verlor dabei die Zeilen aus dem Blick.
          Mit fester Höhe bleibt er immer erreichbar. */}
      <div
        ref={scrollBox}
        onScroll={beimScrollen}
        className="scrollbar-thin overflow-auto rounded-(--radius) border [max-height:70vh]"
      >
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t("tasksCalendar.loading")}
          </p>
        ) : (
          <div style={{ width: gridWidth }} className="relative">
            {/* Tag-Header — bleibt beim senkrechten Scrollen oben stehen
                (`sticky top-0`). Ohne das lief die Datumsleiste mit den
                Objektzeilen aus dem Bild, und ab der dritten Zeile stand jeder
                Balken über einer unbeschrifteten Spalte: gemeldet als „die
                Datumsleiste oben läuft nicht mit". Das z-30 muss ÜBER dem
                z-20 der Objektspalte liegen, sonst schiebt sich deren
                sticky-Kante beim Scrollen über die Datumszeile. */}
            <div className="sticky top-0 z-30 flex border-b bg-card">
              <div
                style={{ width: `${LABEL}rem` }}
                // Die Ecke oben links steht in BEIDEN Richtungen fest und
                // braucht deshalb das höchste z — sonst wandern die
                // Datumsspalten beim Querscrollen darüber hinweg.
                className="sticky left-0 z-40 shrink-0 border-r bg-card"
              />
              {Array.from({ length: days }, (_, i) => {
                const d = tagPlus(firstDay, i);
                return (
                  <div
                    key={i}
                    style={{ width: `${COL}rem` }}
                    className="shrink-0 border-r px-1 py-2 text-center uppercase last:border-r-0"
                  >
                    <div className="text-[0.7rem] font-semibold text-muted-foreground">
                      {d.getUTCDate()}. {MONTHS[d.getUTCMonth()]}{" "}
                      {d.getUTCFullYear()}
                    </div>
                    <div className="text-[0.65rem] text-muted-foreground/80">
                      {WEEKDAYS[d.getUTCDay()]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Heute-Linie */}
            {todayIdx !== null && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-red-500"
                style={{ left: `${LABEL + todayIdx * COL + COL / 2}rem` }}
              />
            )}

            {/* Objektzeilen */}
            {visibleRows.map((row) => {
              // Balken in Lanes packen (keine Überlappung): Buchungen zuerst,
              // dann Aufgaben. Jede Lane ist eine eigene Höhen-Ebene.
              const bookingLanes = packLanes(
                row.bookings.map((b) => ({
                  id: b.id,
                  start: dayIndex(b.check_in, firstDay, days),
                  end: Math.max(
                    dayIndex(b.check_in, firstDay, days) + 1,
                    dayIndex(b.check_out, firstDay, days),
                  ),
                  data: b,
                })),
              );
              const zone = row.timezone ?? null;
              const zeilenKey = row.property_id ?? "misc";
              const taskLanes = packLanes(
                row.tasks.map((t) => {
                  // `due_at` ist das ENDE der Aufgabe, nicht ihr Beginn:
                  // `engine.py` schreibt `due_at = (end or start)`. Als
                  // Startspalte gelesen, landete eine Aufgabe, die um 00:00 des
                  // Folgetags endet, eine Spalte HINTER ihrer Buchung — so
                  // stand die Reinigung am 14. September, obwohl ihr `start_at`
                  // korrekt auf dem Abreisetag lag (103 Aufgaben live, gemessen
                  // am 03.09.2026). Fehlt `start_at` ganz (Altbestand), bleibt
                  // `due_at` die einzige Quelle; dann wird sein Tag genommen,
                  // aber die Aufgabe wird ganztags gezeichnet, statt aus einem
                  // Ende eine Anfangsstunde zu erfinden.
                  const hatStart = Boolean(t.start_at);
                  const iso = t.start_at ?? t.due_at;
                  const s = iso ? dayIndex(iso, firstDay, days, zone) : 0;
                  const tag = iso ? tagInZone(iso, zone) : null;
                  // AN DER BUCHUNG AUSRICHTEN (03.09.2026): Der Buchungsbalken
                  // beginnt halbtags versetzt (Anreise mittags) und endet
                  // mittags am Abreisetag. Eine Aufgabe am Anreisetag, die
                  // buendig links in der Spalte sitzt, steht damit optisch
                  // VOR dem Balken — „kreuz und quer", obwohl der Tag stimmt.
                  // Deshalb: Anreisetag = zweite Haelfte (unter dem Balken-
                  // anfang), Abreisetag = erste Haelfte (unter dem Balkenende).
                  // Genau so macht es der Multikalender fuer seine Nebenbalken
                  // (calendar-board.tsx, „Steht davor eine Buchung, beginnt
                  // sie versetzt"). Ohne Buchung entscheidet die Uhrzeit.
                  const buchung = t.reservation_id
                    ? row.bookings.find((b) => b.id === t.reservation_id)
                    : undefined;
                  let h: { versatz: number; breite: number };
                  if (buchung && tag === buchung.check_in) {
                    h = { versatz: HALF_DAY, breite: HALF_DAY };
                  } else if (buchung && tag === buchung.check_out) {
                    h = { versatz: 0, breite: HALF_DAY };
                  } else if (hatStart) {
                    // Halbtags-Segmente, damit Vor- und Nachmittag desselben
                    // Tages NEBENEINANDER in einer Lane liegen statt gestapelt.
                    h = tagesHaelfte(t.start_at, t.end_at, zone);
                  } else {
                    h = { versatz: 0, breite: 1 };
                  }
                  return {
                    id: t.id,
                    start: s + h.versatz,
                    end: s + h.versatz + h.breite,
                    data: t,
                  };
                }),
              );
              // Vertikale Position jeder Lane (Buchungen oben, Aufgaben unter
              // dem letzten Buchungs-Balken).
              const bookingBlock = bookingLanes.length * (BOOKING_H + LANE_GAP);
              const laneTop = (isBooking: boolean, idx: number) =>
                isBooking
                  ? 0.6 + idx * (BOOKING_H + LANE_GAP)
                  : 0.6 + bookingBlock + idx * (TASK_H + LANE_GAP);
              const contentH =
                bookingBlock + taskLanes.length * (TASK_H + LANE_GAP);
              const rowHeight = Math.max(ROW_MIN, 1.2 + contentH);
              return (
                <div
                  key={row.property_id ?? "misc"}
                  className="flex border-b last:border-b-0"
                  style={{ height: `${rowHeight}rem` }}
                >
                  {/* Objektname (sticky) */}
                  <div
                    style={{ width: `${LABEL}rem` }}
                    // z-20, nicht z-10: Balken und Pillen liegen auf z-10, und ein
                    // spaeteres Geschwister gleicher Ebene zeichnet DARUEBER — die
                    // Objektspalte wirkte durchsichtig, Namen standen ueber den
                    // Pillen (03.09.2026). Die Kopfzeile bleibt mit z-30 darueber.
                    className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-3 text-sm font-medium"
                  >
                    {/* Die objektlose Zeile trägt keinen Titel aus dem Backend —
                        wie sie heißt, gehört in die Sprache der Oberfläche. */}
                    <span className="line-clamp-2">
                      {row.property_id
                        ? row.property_title
                        : t("tasksCalendar.miscRow")}
                    </span>
                  </div>

                  {/* Tages-Fläche: FESTE Breite = days × COL (kein flex!), damit
                      absolute Balken exakt auf dem Tages-Raster sitzen. */}
                  <div
                    className="relative shrink-0"
                    style={{ width: `${days * COL}rem` }}
                  >
                    {/* Hintergrund-Raster + Hover-„+" zum Anlegen je Zelle.
                        SICHTBARKEIT (03.09.2026): die Linien standen auf
                        `border-border/40` und waren in den Objektzeilen nicht
                        zu erkennen — ohne Raster kann niemand ablesen, auf
                        welchem TAG eine Pille sitzt, und genau das war die
                        Frage. Volle Randfarbe, dazu ein getönter Grund am
                        Wochenende und am heutigen Tag als Orientierung. */}
                    {Array.from({ length: days }, (_, i) => {
                      const cellDate = tagKey(i);
                      const wtag = new Date(`${cellDate}T00:00:00Z`).getUTCDay();
                      const wochenende = wtag === 0 || wtag === 6;
                      const istHeute = cellDate === todayKey;
                      // Drop nur in der EIGENEN Zeile annehmen. Ohne
                      // `preventDefault` zeigt der Browser „nicht erlaubt"
                      // und `onDrop` feuert nicht — genau das gewünschte
                      // Verhalten für fremde Zeilen.
                      const istZiel =
                        dropZiel?.zeile === zeilenKey &&
                        dropZiel.tag === cellDate;
                      return (
                        <div
                          key={i}
                          style={{ left: `${i * COL}rem`, width: `${COL}rem` }}
                          onDragOver={(e) => {
                            // Aus dem Ref, nicht aus dem State: der State
                            // hinkt dem Drag um einen Tick hinterher.
                            if (dragRef.current?.zeile !== zeilenKey) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (!istZiel) {
                              setDropZiel({ zeile: zeilenKey, tag: cellDate });
                            }
                          }}
                          onDrop={(e) => {
                            const quelle = dragRef.current;
                            if (quelle?.zeile !== zeilenKey) return;
                            e.preventDefault();
                            const aufgabe = row.tasks.find(
                              (x) => x.id === quelle.id,
                            );
                            dragRef.current = null;
                            setDragAufgabe(null);
                            setDropZiel(null);
                            if (aufgabe) {
                              void aufgabeVerschieben(aufgabe, zone, cellDate);
                            }
                          }}
                          // z-0: die Zelle ist der GRUND der Zeile. Ohne
                          // eigene Ebene liegen die Balken als spätere
                          // Geschwister darüber und verdecken die Trennlinie
                          // in genau den Zeilen, in denen man sie braucht —
                          // dort, wo Pillen stehen. Die Balken bekommen
                          // ihrerseits z-10 (siehe unten), damit sie
                          // anklickbar bleiben.
                          // `border-border` ist rgb(228,228,231) — auf weissem
                          // Grund gemessen praktisch unsichtbar, und genau
                          // deshalb war „kein Raster da" richtig, obwohl 2400
                          // Zellen im DOM standen. `border-neutral-300` ist
                          // die erste Stufe, die man auf Weiss wirklich sieht.
                          className={`group absolute bottom-0 top-0 z-0 border-r border-neutral-300 dark:border-neutral-700 ${
                            istZiel
                              ? "bg-sky-500/20 ring-2 ring-inset ring-sky-500"
                              : istHeute
                                ? "bg-amber-500/10"
                                : wochenende
                                  ? "bg-neutral-100 dark:bg-neutral-800/40"
                                  : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setCreateCell({
                                propertyId: row.property_id,
                                date: cellDate,
                              })
                            }
                            className="absolute bottom-1 left-1 flex size-6 items-center justify-center rounded-full bg-foreground text-background opacity-0 shadow transition-opacity group-hover:opacity-100"
                            aria-label={t("tasksCalendar.createTaskOnDay")}
                          >
                            <Icon icon="ph:plus" className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Buchungs-Balken (Kanal-Farbe = Plattform). Halbtags-
                        Versatz wie im Multikalender: Anreise = halber Tag rein,
                        Auslauf = halber Tag in den Abreisetag. */}
                    {bookingLanes.map((lane, laneIdx) =>
                      lane.map((seg) => {
                        const b = seg.data;
                        const meta = channelMeta(b);
                        // Ragt die echte Check-in-/Check-out-Kante ins Fenster?
                        const startsAtCheckIn = b.check_in >= firstDayKey; // Anreise sichtbar
                        const endsAtCheckOut = b.check_out <= lastDayKey;
                        const leftPad = startsAtCheckIn ? HALF_DAY : 0;
                        const widthCols =
                          seg.end -
                          seg.start -
                          (startsAtCheckIn ? HALF_DAY : 0) +
                          (endsAtCheckOut ? HALF_DAY : 0);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setBookingPop(b)}
                            // Während eine Aufgabe gezogen wird, darf der
                            // Buchungsbalken die Zelle darunter nicht
                            // verdecken — sonst gäbe es über der Buchung
                            // keinen Ablageort, und genau dort liegen die
                            // meisten Aufgaben.
                            className={`absolute z-10 flex flex-col justify-center overflow-hidden rounded-(--radius) px-2 py-1 text-left text-xs shadow-sm ${meta.barBg} ${meta.barFg} ${
                              dragAufgabe ? "pointer-events-none" : ""
                            }`}
                            style={{
                              left: `calc(${seg.start + leftPad} * ${COL}rem + 0.15rem)`,
                              width: `calc(${widthCols} * ${COL}rem - 0.3rem)`,
                              top: `${laneTop(true, laneIdx)}rem`,
                              height: `${BOOKING_H}rem`,
                            }}
                            title={t("tasksCalendar.bookingBarTitle", {
                              guests: b.guests,
                              channel: b.ota_name
                                ? channelLabelLoose(b.ota_name)
                                : channelLabel(b.channel as AvailabilitySource),
                              range: bookingRange(b, locale),
                            })}
                          >
                            <span className="flex items-center gap-1 truncate font-medium leading-tight">
                              <Icon
                                icon="ph:users"
                                className="size-3.5 shrink-0"
                              />
                              {t("tasksCalendar.bookingBarLabel", {
                                guests: b.guests,
                                channel: b.ota_name
                                  ? channelLabelLoose(b.ota_name)
                                  : channelLabel(
                                      b.channel as AvailabilitySource,
                                    ),
                              })}
                            </span>
                            <span className="truncate text-[0.7rem] leading-tight opacity-90">
                              {bookingRange(b, locale)}
                            </span>
                          </button>
                        );
                      }),
                    )}

                    {/* Aufgaben-Balken (Status-Farbe), unter den Buchungen */}
                    {taskLanes.map((lane, laneIdx) =>
                      lane.map((seg) => {
                        const t = seg.data;
                        const st = taskStyle(t, todayKey);
                        const ziehbar = verschiebbar(t);
                        const wirdGezogen = dragAufgabe?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTaskPop(t)}
                            draggable={ziehbar}
                            onDragStart={(e) => {
                              if (!ziehbar) {
                                e.preventDefault();
                                return;
                              }
                              // setData ist Pflicht, sonst startet der Drag in
                              // Firefox/Safari nicht.
                              e.dataTransfer.setData("text/plain", t.id);
                              e.dataTransfer.effectAllowed = "move";
                              const quelle = { id: t.id, zeile: zeilenKey };
                              dragRef.current = quelle;
                              // NICHT synchron — siehe `dragRef`.
                              window.setTimeout(() => {
                                if (dragRef.current === quelle) {
                                  setDragAufgabe(quelle);
                                }
                              }, 0);
                            }}
                            onDragEnd={() => {
                              dragRef.current = null;
                              setDragAufgabe(null);
                              setDropZiel(null);
                            }}
                            // Während des Ziehens muss die Zelle DARUNTER die
                            // Drag-Ereignisse bekommen, nicht die Pille selbst
                            // oder eine Nachbar-Pille: `pointer-events-none`
                            // auf allen Pillen, solange eine gezogen wird.
                            className={`absolute z-10 flex items-center gap-1 overflow-hidden rounded-(--radius) border px-1.5 text-left text-xs shadow-sm ${st.bg} ${st.border} ${st.text} ${
                              ziehbar ? "cursor-grab active:cursor-grabbing" : ""
                            } ${wirdGezogen ? "opacity-40" : ""} ${
                              dragAufgabe ? "pointer-events-none" : ""
                            }`}
                            style={{
                              left: `calc(${seg.start} * ${COL}rem + 0.15rem)`,
                              width: `calc(${seg.end - seg.start} * ${COL}rem - 0.3rem)`,
                              top: `${laneTop(false, laneIdx)}rem`,
                              height: `${TASK_H}rem`,
                            }}
                            title={`${t.assignee_name ?? ""} · ${t.title}`}
                          >
                            <Icon
                              icon={st.icon}
                              className="size-3.5 shrink-0"
                            />
                            <span className="truncate">{t.title}</span>
                          </button>
                        );
                      }),
                    )}

                    {/* DEBUG-RASTER: Messgitter über der Zeile. Es liegt
                        als LETZTES Geschwister auf z-10 ueber den Balken — nicht auf
                        z-20, sonst wanderte es beim Querscrollen ueber die
                        Objektspalte. Es ist zum Messen da und
                        nicht zum Bedienen — verdeckt es eine Pille, ist das
                        genau die Information, die man sehen will. Pro Tag:
                        Spaltennummer und Tagesziffer, plus eine kräftige
                        Kante. Abschaltbar, damit die Ansicht nutzbar bleibt. */}
                    {debugRaster &&
                      Array.from({ length: days }, (_, i) => {
                        const k = tagKey(i);
                        const wtag = new Date(`${k}T00:00:00Z`).getUTCDay();
                        return (
                          <div
                            key={`dbg-${i}`}
                            style={{ left: `${i * COL}rem`, width: `${COL}rem` }}
                            className={`pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 ${
                              wtag === 0 || wtag === 6
                                ? "border-rose-500/70 bg-rose-500/5"
                                : "border-sky-500/70"
                            }`}
                          >
                            <span className="absolute left-0.5 top-0 rounded-br bg-sky-600 px-1 font-mono text-[0.6rem] leading-tight text-white">
                              {i}
                            </span>
                            <span className="absolute bottom-0 left-0.5 rounded-tr bg-neutral-800 px-1 font-mono text-[0.6rem] leading-tight text-white">
                              {k.slice(8)}
                            </span>
                          </div>
                        );
                      })}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createCell && (
        <TaskCreatePopup
          propertyId={createCell.propertyId}
          reservationId={createCell.reservationId ?? null}
          date={createCell.date}
          onClose={() => setCreateCell(null)}
          onCreated={() => {
            setCreateCell(null);
            stillNachladen();
          }}
        />
      )}

      {taskPop && (
        <TaskPopover
          darfZuweisen
          task={taskPop}
          onClose={() => setTaskPop(null)}
          onDeleted={() => {
            setTaskPop(null);
            stillNachladen();
          }}
          onPhotos={() => {
            setPhotoTaskId(taskPop.id);
            setTaskPop(null);
          }}
        />
      )}

      {photoTaskId && (
        <TaskDetailModal
          darfZuweisen
          taskId={photoTaskId}
          onClose={() => setPhotoTaskId(null)}
          onChanged={stillNachladen}
        />
      )}

      {bookingPop && (
        <BookingPopover
          booking={bookingPop}
          adults={bookingPop.adults}
          children={bookingPop.children}
          onClose={() => setBookingPop(null)}
          onCreateTask={() => {
            setCreateCell({
              propertyId: bookingPop.property_id,
              reservationId: bookingPop.id,
              date: bookingPop.check_in,
            });
            setBookingPop(null);
          }}
        />
      )}

      {/* In der Entwicklung immer, in Produktion nur zugeschaltet — dieselbe
          Regel wie beim Realtime-Panel. */}
      {(process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_KALENDER_DEBUG === "1") && (
        <AufgabenKalenderDebug
          zeilen={debugZeilen}
          verschiebungen={verschiebungen}
          rasterAn={debugRaster}
          onRasterAn={setDebugRaster}
        />
      )}
    </div>
  );
}
