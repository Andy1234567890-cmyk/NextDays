"use client";

// Aufgaben-Kalender (.. /tasks): Monats-Timeline als Gantt-Grid.
// Sticky Objektspalte links, feste Tages-Spalten, rote Heute-Linie, je Objekt
// Buchungs-Balken (aus reservations) + Aufgaben-Balken mit Status-Badge.
// Filterleiste (Monat ← →, Nutzer, Objekt, Alles zurücksetzen). Live via
// useRealtime auf tasks + reservations.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AufgabenFilter } from "@/components/reservierungen/aufgaben-filter";
import { BookingPopover } from "@/components/reservierungen/booking-popover";
import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { TaskCreatePopup } from "@/components/reservierungen/task-create-popup";
import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { TaskPopover } from "@/components/reservierungen/task-popover";
import { CHANNEL_META } from "@/lib/calendar-channels";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import type { AvailabilitySource } from "@/lib/calendar";
import { listTenantUsers } from "@/lib/account";
import { UNASSIGNED } from "@/lib/aufgaben-konstanten";
import {
  type CalendarBooking,
  type CalendarRow,
  type TaskListItem,
  getTaskCalendar,
  listRules,
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

function monthBounds(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  return {
    from: from.toISOString(),
    to: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59)).toISOString(),
    days: to.getUTCDate(),
    firstDay: from,
  };
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
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Ladefehler (z. B. 403) sichtbar machen statt still leeren Kalender zeigen
  // (Wurzel 5).
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const { from, to, days, firstDay } = useMemo(
    () => monthBounds(year, month),
    [year, month],
  );

  const load = useCallback(async () => {
    setLoading(true);
    // Mehrfachauswahl wirkt wirklich: vorher wurde der Nutzerfilter nur bei
    // GENAU einer Auswahl an den Server gegeben, jede weitere blieb folgenlos.
    const res = await getTaskCalendar(from, to, {
      assignee_ids: userFilter,
      rule_ids: ruleFilter,
    });
    if (res.ok) {
      setRows(res.data.rows);
      setLoadError(null);
    } else {
      // Fehler NIE verschlucken: sonst wirkt der Aufgaben-Kalender „kaputt".
      setLoadError(res.error);
      setRows([]);
    }
    setLoading(false);
  }, [from, to, userFilter, ruleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const [tenantUsers, autoRules] = await Promise.all([
        listTenantUsers(),
        listRules("auto"),
      ]);
      if (tenantUsers.ok) {
        setUsers([
          ...tenantUsers.data.map((u) => ({
            value: u.user_id,
            label: u.full_name ?? u.email ?? u.user_id,
          })),
          { value: UNASSIGNED, label: t("aufgabenFilter.unassignedOption") },
        ]);
      }
      if (autoRules.ok) {
        setRules(autoRules.data.map((r) => ({ value: r.id, label: r.name })));
      }
    })();
  }, [t]);

  useRealtime({ table: "tasks", onChange: load });
  useRealtime({ table: "reservations", onChange: load });

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };

  const propOptions = useMemo(
    () =>
      rows
        .filter((r) => r.property_id)
        .map((r) => ({ value: r.property_id as string, label: r.property_title })),
    [rows],
  );

  const visibleRows = useMemo(() => {
    if (propFilter.length === 0) return rows;
    return rows.filter(
      (r) => r.property_id === null || propFilter.includes(r.property_id),
    );
  }, [rows, propFilter]);

  // Heute-Linie nur, wenn der aktuelle Monat angezeigt wird.
  const todayIdx =
    now.getFullYear() === year && now.getMonth() === month
      ? now.getDate() - 1
      : null;

  const gridWidth = `${LABEL + days * COL}rem`;
  // Monatsränder als ISO-Datum (yyyy-mm-dd) für die Halbtags-Randerkennung.
  const pad = (n: number) => String(n).padStart(2, "0");
  const firstDayKey = `${year}-${pad(month + 1)}-01`;
  const lastDayKey = `${year}-${pad(month + 1)}-${pad(days)}`;
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("tasksCalendar.breadcrumbHome")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">{t("tasksCalendar.breadcrumbTasks")}</span>
      </nav>

      {loadError && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </div>
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

        <div className="flex flex-wrap items-start gap-4">
          {/* Navigation (Monat) */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {t("tasksCalendar.navigationLabel")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shift(-1)}
                className="flex size-9 items-center justify-center rounded-full bg-secondary hover:bg-muted"
                aria-label={t("tasksCalendar.previousMonth")}
              >
                <Icon icon="ph:arrow-left" className="size-4" />
              </button>
              <span className="min-w-28 rounded-full bg-secondary px-4 py-2 text-center text-sm font-semibold">
                {MONTHS[month]} {year}
              </span>
              <button
                type="button"
                onClick={() => shift(1)}
                className="flex size-9 items-center justify-center rounded-full bg-secondary hover:bg-muted"
                aria-label={t("tasksCalendar.nextMonth")}
              >
                <Icon icon="ph:arrow-right" className="size-4" />
              </button>
            </div>
          </div>

          {/* Aufgabe · Benutzer · Unterkünfte — dieselben Auswahldialoge wie in
              den Listen (Suchfeld, Alle/Nichts selektieren, Speichern). */}
          <AufgabenFilter
            zusatzReset={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
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

      {/* Grid */}
      <div className="overflow-x-auto rounded-(--radius) border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t("tasksCalendar.loading")}
          </p>
        ) : (
          <div style={{ width: gridWidth }} className="relative">
            {/* Tag-Header */}
            <div className="flex border-b bg-card">
              <div
                style={{ width: `${LABEL}rem` }}
                className="sticky left-0 z-20 shrink-0 border-r bg-card"
              />
              {Array.from({ length: days }, (_, i) => {
                const d = new Date(
                  Date.UTC(year, month, i + 1),
                );
                return (
                  <div
                    key={i}
                    style={{ width: `${COL}rem` }}
                    className="shrink-0 border-r px-1 py-2 text-center uppercase last:border-r-0"
                  >
                    <div className="text-[0.7rem] font-semibold text-muted-foreground">
                      {i + 1}. {MONTHS[month]} {year}
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
                      const cellDate = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
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
                        const startsAtCheckIn =
                          b.check_in >= firstDayKey; // Anreise sichtbar
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
                              channel: b.ota_name ?? channelLabel(b.channel as AvailabilitySource),
                              range: bookingRange(b, locale),
                            })}
                          >
                            <span className="flex items-center gap-1 truncate font-medium leading-tight">
                              <Icon icon="ph:users" className="size-3.5 shrink-0" />
                              {t("tasksCalendar.bookingBarLabel", {
                                guests: b.guests,
                                channel: b.ota_name ?? channelLabel(b.channel as AvailabilitySource),
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
                            <Icon icon={st.icon} className="size-3.5 shrink-0" />
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
            load();
          }}
        />
      )}

      {taskPop && (
        <TaskPopover
          task={taskPop}
          onClose={() => setTaskPop(null)}
          onDeleted={() => {
            setTaskPop(null);
            load();
          }}
          onPhotos={() => {
            setPhotoTaskId(taskPop.id);
            setTaskPop(null);
          }}
        />
      )}

      {photoTaskId && (
        <TaskDetailModal
          taskId={photoTaskId}
          onClose={() => setPhotoTaskId(null)}
          onChanged={load}
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
