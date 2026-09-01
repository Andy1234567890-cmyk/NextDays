"use client";

// Aufgaben-Kalender (.. /tasks): Monats-Timeline als Gantt-Grid.
// Sticky Objektspalte links, feste Tages-Spalten, rote Heute-Linie, je Objekt
// Buchungs-Balken (aus reservations) + Aufgaben-Balken mit Status-Badge.
// Filterleiste (Monat ← →, Nutzer, Objekt, Alles zurücksetzen). Live via
// useRealtime auf tasks + reservations.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
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
import {
  type CalendarBooking,
  type CalendarRow,
  type TaskListItem,
  getTaskCalendar,
  listRules,
  listTaskAssignees,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

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

// Tag-Index (0-basiert) eines ISO-Datums innerhalb des Monats; clampt an Rand.
function dayIndex(iso: string, firstDay: Date, days: number): number {
  const d = new Date(iso);
  const diff = Math.floor(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      firstDay.getTime()) /
      86_400_000,
  );
  return Math.max(0, Math.min(days, diff));
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
              const taskLanes = packLanes(
                row.tasks.map((t) => {
                  const iso = t.start_at ?? t.due_at;
                  const s = iso ? dayIndex(iso, firstDay, days) : 0;
                  return { id: t.id, start: s, end: s + 1, data: t };
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
                    className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-card px-3 text-sm font-medium"
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
                    {/* Hintergrund-Raster + Hover-„+" zum Anlegen je Zelle */}
                    {Array.from({ length: days }, (_, i) => {
                      const cellDate = tagKey(i);
                      return (
                        <div
                          key={i}
                          style={{ left: `${i * COL}rem`, width: `${COL}rem` }}
                          className="group absolute bottom-0 top-0 border-r border-border/40"
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
                            className={`absolute flex flex-col justify-center overflow-hidden rounded-(--radius) px-2 py-1 text-left text-xs shadow-sm ${meta.barBg} ${meta.barFg}`}
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
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTaskPop(t)}
                            className={`absolute flex items-center gap-1 overflow-hidden rounded-(--radius) border px-1.5 text-left text-xs shadow-sm ${st.bg} ${st.border} ${st.text}`}
                            style={{
                              left: `${seg.start * COL + 0.15}rem`,
                              width: `${COL - 0.3}rem`,
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
    </div>
  );
}
