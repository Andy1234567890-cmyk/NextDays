"use client";

// Belegungs-/Auslastungs-Ansicht (Performance-Blick): Objekte als Zeilen, Tage
// als Spalten. Optik UND Scrollverhalten folgen dem Timeline-Belegungsplan
// (calendar-board): durchgehender Zeitstrahl vom 1. Januar des laufenden Jahres
// bis Ende des Folgejahres, virtualisiert gerendert, Start bei HEUTE — kein
// festes 30/60/90-Fenster mehr. Monatsbänder, Tageskopf mit Wochentag +
// Datums-Pille, Heute-Akzent, Wochenend-Tönung, sticky Objektspalte mit Foto;
// zusammenhängende Belegungen als EIN abgerundeter Balken statt eines Rasters
// harter Vollton-Kacheln. Die Kennzahlen oben werten ein wählbares Fenster ab
// heute aus (30/60/90 Tage). Aggregat rein im Frontend aus listReservations() +
// Board (kein neuer Endpunkt); Board-Tage werden beim Scrollen chunkweise
// nachgeladen. Realtime auf reservations/availability/stop_sell.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Segmented } from "@nextdays/ui/segmented";
import { getBoard } from "@/lib/calendar";
import { usePropertyLabels } from "@/lib/use-property-labels";
import {
  addDays,
  dateKey,
  occupancyMatrix,
  parseKey,
} from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

// Rastermaße: Tagesspalte breit genug für Wochentag + Datum (wie im
// Belegungsplan lesbar), Zeilenhöhe kompakt — gescrollt wird ohnehin endlos.
const COL = 4; // rem pro Tagesspalte
const LABEL = 17; // rem für die Objektspalte
const ROW_H = 3.25; // rem Zeilenhöhe
// Zusätzlich gerenderte Spalten links/rechts des Sichtfensters (Scroll-Puffer).
const OVERSCAN = 12;
// Chunk-Größe (Tage) für das Nachladen der Board-Tage beim Scrollen.
const CHUNK_DAYS = 90;

const WEEKDAY_KEYS = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;
const MONTH_KEYS = [
  "januar", "februar", "maerz", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "dezember",
] as const;

// Durchgehender Zeitstrahl wie im Belegungsplan: 1. Januar des VORJAHRES bis
// 31. Dezember des Folgejahres. Die Spanne MUSS die des Belegungsplans
// (`calendar-board.tsx`, `VORLAUF_JAHRE`) treffen — sonst endet dieselbe
// Ansicht je nach gewähltem Plan an einem anderen Tag, und der Nutzer sucht
// den Unterschied im Bestand statt im Raster.
const VORLAUF_JAHRE = 1;

function rangeStartOf(now: Date): Date {
  return new Date(now.getFullYear() - VORLAUF_JAHRE, 0, 1);
}
function rangeEndOf(now: Date): Date {
  return new Date(now.getFullYear() + 1, 11, 31);
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Zusammenhängende Belegungs-Läufe einer Zeile (Start-Index + Länge). */
function bookedRuns(
  dayKeys: string[],
  booked: Record<string, boolean> | undefined,
): { start: number; span: number }[] {
  const runs: { start: number; span: number }[] = [];
  let start = -1;
  for (let i = 0; i < dayKeys.length; i += 1) {
    const on = booked?.[dayKeys[i]] === true;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push({ start, span: i - start });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, span: dayKeys.length - start });
  return runs;
}

export function CalendarOccupancyView({ properties }: { properties: Prop[] }) {
  const t = useTranslations("calendar");
  // aria-Label der Info-Punkte: app-weit dieselbe Formulierung, deshalb aus
  // `common` und nicht je Fläche neu erfunden.
  const tGemein = useTranslations("common");
  const { typeLabel } = usePropertyLabels();
  const locale = useLocale();
  const WINDOWS = useMemo(
    () =>
      [
        { value: 30, label: t("occupancyView.window", { count: 30 }) },
        { value: 60, label: t("occupancyView.window", { count: 60 }) },
        { value: 90, label: t("occupancyView.window", { count: 90 }) },
      ] as const,
    [t],
  );
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // Belegte/gesperrte Tage je Objekt aus dem Board (availability=0: Block,
  // Stop-Sell, OTA-Import) — sie erscheinen NICHT in reservations.
  const [blockedByProp, setBlockedByProp] = useState<Record<string, Set<string>>>(
    {},
  );
  // Kennzahlen-Fenster ab heute (das Raster selbst scrollt endlos).
  const [windowDays, setWindowDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  // Zeitstrahl-Geometrie, stabil pro Mount.
  const now = useMemo(() => new Date(), []);
  const start = useMemo(() => rangeStartOf(now), [now]);
  const totalDays = useMemo(
    () => daysBetween(rangeStartOf(now), rangeEndOf(now)) + 1,
    [now],
  );
  const todayKey = useMemo(() => dateKey(now), [now]);
  const todayIndex = useMemo(
    () => daysBetween(start, parseKey(todayKey)),
    [start, todayKey],
  );

  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  // --- Scroll-Container + Virtualisierung (nur sichtbare Spalten rendern) ---
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [visFrom, setVisFrom] = useState(0);
  const [visTo, setVisTo] = useState(30 + OVERSCAN);
  const remPx = useCallback(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    [],
  );
  const recomputeWindow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const colPx = COL * remPx();
    const leftmost = Math.round(el.scrollLeft / colPx);
    const from = Math.max(0, leftmost - OVERSCAN);
    const visibleCols = Math.ceil(el.clientWidth / colPx);
    setVisFrom(from);
    setVisTo(Math.min(totalDays, from + visibleCols + OVERSCAN * 2));
  }, [remPx, totalDays]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recomputeWindow();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    recomputeWindow();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [recomputeWindow]);

  const scrollToIndex = useCallback(
    (di: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ left: Math.max(0, di * COL * remPx()), behavior });
    },
    [remPx],
  );

  // Beim ersten Rendern auf HEUTE springen (der Zeitstrahl beginnt im Januar).
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    if (!scrollRef.current) return;
    didInitialScroll.current = true;
    scrollToIndex(todayIndex, "auto");
    recomputeWindow();
  }, [scrollToIndex, recomputeWindow, todayIndex]);

  // --- Daten -----------------------------------------------------------------
  // Reservierungen kommen komplett (ein Call, deckt den ganzen Zeitstrahl ab).
  const loadReservations = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) setReservations(res.data.items);
    setLoading(false);
  }, []);

  // Board-Tage (Block/Stop-Sell/OTA) chunkweise — nur für den sichtbaren
  // Bereich, sonst wären es zwei Jahre × alle Objekte auf einmal.
  const loadedChunks = useRef<Set<number>>(new Set());
  const loadChunks = useCallback(
    async (fromIdx: number, toIdx: number) => {
      if (propertyIds.length === 0) return;
      const first = Math.floor(Math.max(0, fromIdx) / CHUNK_DAYS);
      const last = Math.floor(Math.max(0, toIdx - 1) / CHUNK_DAYS);
      const missing: number[] = [];
      for (let c = first; c <= last; c += 1) {
        if (!loadedChunks.current.has(c)) {
          loadedChunks.current.add(c);
          missing.push(c);
        }
      }
      if (missing.length === 0) return;
      const results = await Promise.all(
        missing.map((c) => {
          const from = addDays(start, c * CHUNK_DAYS);
          const to = addDays(start, Math.min(totalDays, (c + 1) * CHUNK_DAYS));
          return getBoard(propertyIds, dateKey(from), dateKey(to));
        }),
      );
      const merged: Record<string, string[]> = {};
      results.forEach((board, i) => {
        if (!board.ok) {
          // Chunk erneut versuchbar machen (kein stiller Dauer-Ausfall).
          loadedChunks.current.delete(missing[i]);
          return;
        }
        for (const item of board.data.items) {
          const days = merged[item.property_id] ?? (merged[item.property_id] = []);
          for (const d of item.days) if (d.status !== "open") days.push(d.date);
          for (const s of item.stop_sell) days.push(s.date);
        }
      });
      if (Object.keys(merged).length === 0) return;
      setBlockedByProp((prev) => {
        const next: Record<string, Set<string>> = { ...prev };
        for (const [pid, days] of Object.entries(merged)) {
          const set = new Set(next[pid] ?? []);
          for (const d of days) set.add(d);
          next[pid] = set;
        }
        return next;
      });
    },
    [propertyIds, start, totalDays],
  );

  // Alles neu holen (Erststart + Realtime): geladene Chunks verwerfen und den
  // sichtbaren Bereich frisch ziehen — sonst bliebe ein alter Block stehen.
  const reload = useCallback(async () => {
    loadedChunks.current.clear();
    setBlockedByProp({});
    await Promise.all([loadReservations(), loadChunks(visFrom, visTo)]);
  }, [loadReservations, loadChunks, visFrom, visTo]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  // Sichtfenster geändert → fehlende Chunks nachladen (ref, damit der Effect
  // nur am Fenster hängt und nicht bei jedem Render neu feuert).
  const loadChunksRef = useRef(loadChunks);
  loadChunksRef.current = loadChunks;
  useEffect(() => {
    void loadChunksRef.current(visFrom, visTo);
  }, [visFrom, visTo]);

  // Realtime-Pflicht: NICHT nur reservations — auch availability + stop_sell,
  // damit ein Block/Stop-Sell/OTA-Import die Auslastung sofort aktualisiert
  // (konsistent zum Timeline-Board).
  useRealtime({ table: "reservations", onChange: reload });
  useRealtime({ table: "availability", onChange: reload });
  useRealtime({ table: "stop_sell", onChange: reload });

  const matrix = useMemo(
    () =>
      occupancyMatrix(reservations, propertyIds, start, totalDays, blockedByProp),
    [reservations, propertyIds, start, totalDays, blockedByProp],
  );

  // Kennzahlen des gewählten Fensters ab heute: Ø-Auslastung, belegte
  // Objektnächte, stärkster Tag.
  const kpi = useMemo(() => {
    const keys = matrix.dayKeys.slice(todayIndex, todayIndex + windowDays);
    const ratios = keys.map((k) => matrix.perDay[k].ratio);
    const avg =
      ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const bookedNights = keys.reduce((sum, k) => sum + matrix.perDay[k].booked, 0);
    let best: { key: string; ratio: number } | null = null;
    for (const k of keys) {
      const r = matrix.perDay[k].ratio;
      if (!best || r > best.ratio) best = { key: k, ratio: r };
    }
    return {
      avg,
      bookedNights,
      totalNights: properties.length * keys.length,
      best: best && best.ratio > 0 ? best : null,
    };
  }, [matrix, properties.length, todayIndex, windowDays]);

  // Auslastung je Objekt im Kennzahlen-Fenster (Badge in der Objektspalte).
  const rowPct = useMemo(() => {
    const keys = matrix.dayKeys.slice(todayIndex, todayIndex + windowDays);
    const out: Record<string, number> = {};
    for (const pid of propertyIds) {
      const row = matrix.perProperty[pid];
      const booked = keys.reduce((n, k) => n + (row?.[k] === true ? 1 : 0), 0);
      out[pid] = keys.length === 0 ? 0 : Math.round((booked / keys.length) * 100);
    }
    return out;
  }, [matrix, propertyIds, todayIndex, windowDays]);

  // Monatsbänder über dem Tageskopf — nur für das sichtbare Fenster.
  const monthBands = useMemo(() => {
    const bands: { key: string; label: string; span: number }[] = [];
    for (const k of matrix.dayKeys.slice(visFrom, visTo)) {
      const d = parseKey(k);
      const id = `${d.getFullYear()}-${d.getMonth()}`;
      const last = bands[bands.length - 1];
      if (last && last.key === id) last.span += 1;
      else {
        bands.push({
          key: id,
          label: `${t(`calendarBoard.months.${MONTH_KEYS[d.getMonth()]}`)} ${d.getFullYear()}`,
          span: 1,
        });
      }
    }
    return bands;
  }, [matrix.dayKeys, visFrom, visTo, t]);

  const fmtDate = useCallback(
    (k: string) =>
      parseKey(k).toLocaleDateString(locale, { day: "numeric", month: "short" }),
    [locale],
  );

  const visibleKeys = matrix.dayKeys.slice(visFrom, visTo);
  const padLeft = `${visFrom * COL}rem`;
  const padRight = `${(totalDays - visTo) * COL}rem`;

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Kennzahlen-Fenster + Sprung zu heute ===== */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={windowDays} onChange={setWindowDays} options={WINDOWS} />
        <Button
          variant="outline"
          className="ml-auto"
          onClick={() => scrollToIndex(todayIndex)}
        >
          <Icon icon="ph:crosshair" className="size-4" />
          {t("occupancyView.jumpToday")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Die Bezugsgröße („über 90 Tage", „von 900 möglichen") steckt hinter
            dem „i" neben der Beschriftung, statt als vierte Zeile unter der
            Zahl zu stehen — sonst drückt der Erklärtext die Kennzahl, um die
            es geht, optisch an den Rand. `InfoHinweis` ist ein Popover, kein
            Tooltip: es öffnet auf Klick und ist damit auch auf dem Tablet
            erreichbar (packages/ui/src/info-hinweis.tsx). */}
        <Card className="flex flex-col gap-2 p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("occupancyView.avgOccupancyPrefix")}
            <InfoHinweis
              titel={t("occupancyView.avgOccupancyPrefix")}
              text={t("occupancyView.overDays", { count: windowDays })}
              ariaLabel={tGemein("explain", {
                label: t("occupancyView.avgOccupancyPrefix"),
              })}
            />
          </span>
          <span className="font-display text-3xl font-bold tabular-nums">
            {Math.round(kpi.avg * 100)}%
          </span>
          <span
            className="h-1.5 overflow-hidden rounded-full bg-secondary"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.round(kpi.avg * 100)}%` }}
            />
          </span>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("occupancyView.kpiBookedNights")}
            <InfoHinweis
              titel={t("occupancyView.kpiBookedNights")}
              text={t("occupancyView.kpiOfNights", { count: kpi.totalNights })}
              ariaLabel={tGemein("explain", {
                label: t("occupancyView.kpiBookedNights"),
              })}
            />
          </span>
          <span className="font-display text-3xl font-bold tabular-nums">
            {kpi.bookedNights}
          </span>
        </Card>

        {/* Beim stärksten Tag wandert nur die ERKLÄRUNG hinter das „i" — der
            Leerzustand („Keine Belegung") bleibt sichtbarer Text. Eine
            Fehlanzeige hinter einem Klick zu verstecken hieße, eine leere
            Kachel ohne Grund zu zeigen. */}
        <Card className="flex flex-col gap-2 p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("occupancyView.kpiBestDay")}
            {kpi.best && (
              <InfoHinweis
                titel={t("occupancyView.kpiBestDay")}
                text={`${Math.round(kpi.best.ratio * 100)}% · ${matrix.perDay[kpi.best.key].booked}/${properties.length}`}
                ariaLabel={tGemein("explain", {
                  label: t("occupancyView.kpiBestDay"),
                })}
              />
            )}
          </span>
          <span className="font-display text-3xl font-bold capitalize tabular-nums">
            {kpi.best ? fmtDate(kpi.best.key) : "–"}
          </span>
          {!kpi.best && (
            <span className="text-xs text-muted-foreground">
              {t("occupancyView.kpiNoBookings")}
            </span>
          )}
        </Card>
      </div>

      {/* ===== Endlos scrollendes Raster ===== */}
      <Card className="overflow-hidden p-0">
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ width: `${LABEL + totalDays * COL}rem` }}>
            {/* Monatsband */}
            <div className="flex border-b bg-secondary/40">
              <div
                className="sticky left-0 z-20 shrink-0 border-r bg-secondary/40"
                style={{ width: `${LABEL}rem` }}
              />
              <div className="shrink-0" style={{ width: padLeft }} />
              {monthBands.map((b) => (
                <div
                  key={b.key}
                  className="shrink-0 truncate border-r px-3 py-1 text-xs font-semibold text-foreground"
                  style={{ width: `${b.span * COL}rem` }}
                >
                  {b.label}
                </div>
              ))}
              <div className="shrink-0" style={{ width: padRight }} />
            </div>

            {/* Tageskopf: Wochentag + Datums-Pille (heute im Akzent). */}
            <div className="flex border-b">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: `${LABEL}rem` }}
              >
                {t("occupancyView.propertyColumn")}
              </div>
              <div className="shrink-0" style={{ width: padLeft }} />
              {visibleKeys.map((k) => {
                const d = parseKey(k);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = k === todayKey;
                return (
                  <div
                    key={k}
                    className={`flex shrink-0 flex-col items-center gap-0.5 border-r py-2 ${weekend ? "bg-secondary/40" : ""}`}
                    style={{ width: `${COL}rem` }}
                  >
                    <span className="text-xs uppercase text-muted-foreground">
                      {t(`calendarBoard.weekdays.${WEEKDAY_KEYS[d.getDay()]}`)}
                    </span>
                    <span
                      className={`flex size-8 items-center justify-center rounded-full text-base font-semibold tabular-nums ${isToday ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
              <div className="shrink-0" style={{ width: padRight }} />
            </div>

            {/* Tages-Auslastung als Mini-Säulen (statt flächigem Farbwisch). */}
            <div className="flex border-b bg-card">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card px-4 py-2"
                style={{ width: `${LABEL}rem` }}
              >
                <Icon icon="ph:chart-bar" className="size-4 text-muted-foreground" />
                <span className="truncate text-xs font-semibold text-muted-foreground">
                  {t("occupancyView.legendDayTotal")}
                </span>
              </div>
              <div className="shrink-0" style={{ width: padLeft }} />
              {visibleKeys.map((k) => {
                const cell = matrix.perDay[k];
                const d = parseKey(k);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const pct = Math.round(cell.ratio * 100);
                return (
                  <div
                    key={k}
                    title={t("occupancyView.dayHeaderTooltip", {
                      date: fmtDate(k),
                      booked: cell.booked,
                      total: properties.length,
                    })}
                    className={`flex shrink-0 flex-col items-center justify-end gap-1 border-r px-2 pb-1.5 pt-2 ${weekend ? "bg-secondary/40" : ""}`}
                    style={{ width: `${COL}rem`, height: "3.5rem" }}
                  >
                    <span className="text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                    <span
                      className={`w-full rounded-t-sm ${cell.ratio > 0 ? "bg-accent/70" : "bg-secondary"}`}
                      style={{ height: `${Math.max(6, pct * 0.6)}%` }}
                    />
                  </div>
                );
              })}
              <div className="shrink-0" style={{ width: padRight }} />
            </div>

            {/* Objektzeilen */}
            {properties.map((p) => {
              const row = matrix.perProperty[p.id];
              // Nur Läufe rendern, die das Sichtfenster berühren (Balken liegen
              // absolut über der vollen Zeilenbreite).
              const runs = bookedRuns(matrix.dayKeys, row).filter(
                (r) => r.start < visTo && r.start + r.span > visFrom,
              );
              return (
                <div key={p.id} className="flex border-b last:border-b-0">
                  {/* Objektspalte (sticky, Foto + Name + Auslastung im Fenster) */}
                  <Link
                    href={`/objekte/${p.id}`}
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-r bg-card px-3 py-2 hover:bg-muted"
                    style={{ width: `${LABEL}rem` }}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt="" className="size-full object-cover" />
                      ) : (
                        <Icon icon="ph:house-line" className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {p.city || typeLabel(p.type)}
                      </span>
                    </span>
                    <span
                      title={t("occupancyView.propertyOccupancyTitle")}
                      className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
                    >
                      {rowPct[p.id] ?? 0}%
                    </span>
                  </Link>

                  {/* Tagesbereich: helle Spur + abgerundete Belegungsbalken */}
                  <div
                    className="relative flex self-stretch"
                    style={{
                      width: `${totalDays * COL}rem`,
                      minHeight: `${ROW_H}rem`,
                    }}
                  >
                    <div className="shrink-0" style={{ width: padLeft }} />
                    {visibleKeys.map((k) => {
                      const d = parseKey(k);
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = k === todayKey;
                      const booked = row?.[k] === true;
                      return (
                        <span
                          key={k}
                          title={t("occupancyView.cellTooltip", {
                            property: p.title,
                            date: fmtDate(k),
                            status: booked
                              ? t("occupancyView.statusBooked")
                              : t("occupancyView.statusFree"),
                          })}
                          className={`shrink-0 self-stretch border-r ${isToday ? "bg-accent/5" : weekend ? "bg-secondary/40" : ""}`}
                          style={{ width: `${COL}rem` }}
                        />
                      );
                    })}
                    <div className="shrink-0" style={{ width: padRight }} />

                    {runs.map((run) => (
                      <span
                        key={run.start}
                        title={t("occupancyView.barTooltip", {
                          property: p.title,
                          from: fmtDate(matrix.dayKeys[run.start]),
                          to: fmtDate(matrix.dayKeys[run.start + run.span - 1]),
                          count: run.span,
                        })}
                        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-accent/85 transition-colors hover:bg-accent"
                        style={{
                          left: `calc(${run.start} * ${COL}rem + 0.2rem)`,
                          width: `calc(${run.span} * ${COL}rem - 0.4rem)`,
                          height: "1.5rem",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {properties.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Icon icon="ph:house-line" className="size-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  {t("occupancyView.noProperties")}
                </p>
              </div>
            )}
            {loading && properties.length > 0 && (
              <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                {t("occupancyView.loading")}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full bg-accent/85" />
          {t("occupancyView.legendBookedProperty")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full border bg-card" />
          {t("occupancyView.statusFree")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full bg-secondary/70" />
          {t("occupancyView.legendWeekend")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:chart-bar" className="size-3.5" />
          {t("occupancyView.legendDayTotal")}
        </span>
      </div>
    </div>
  );
}
