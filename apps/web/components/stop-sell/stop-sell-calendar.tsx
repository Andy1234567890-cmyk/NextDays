"use client";

// Stop-Sell-Kalender (Konvergenzmuster der PMS-Multikalender, verifiziert
// gegen Hostaway/Guesty/Smoobu/../Airbnb/Booking): Zeilen = Objekte
// (sticky links), Spalten = Tage (180-Tage-Fenster ab heute), Drag über die
// Tage einer Objektzeile wählt einen Zeitraum → rechtes Seiten-Panel setzt/
// hebt den Stop-Sell auf (mit Wochentags-Maske, Grund + Notiz).
//
// Ebenen je Tageszelle: Belegungs-Status (frei/gebucht/gesperrt aus
// availability — nur Anzeige, die Wahrheit bleibt im /kalender) + der
// Stop-Sell als EIGENE Ebene darüber (manuell = Hand, Portal = Schloss,
// read-only). Preise gehören bewusst NICHT hierher — dafür gibt es den
// Belegungsplan; diese Seite ist der fokussierte Stop-Sell-Kanal.
// Live per Supabase-Realtime (stop_sell/availability/reservations).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  getAvailability,
  listStopSell,
  type DayAvailability,
  type StopSellDay,
} from "@/lib/calendar";
import { isoPlus, isoWeekday, todayIso } from "@/lib/dates";
import { listReservations, type Reservation } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

import {
  type AgencyOption,
  StopSellPanel,
  type StopSellSelection,
} from "./stop-sell-panel";

type Property = { id: string; title: string };

const DAYS_AHEAD = 180; // Fenster ab heute (Channex nimmt nur Zukunft an)
const CHUNK = 90; // Backend-freundliche Ladeblöcke (wie der Belegungsplan)
const COL = 2.5; // rem — Spaltenbreite pro Tag
const ROW = 3; // rem — Zeilenhöhe pro Objekt
const LABEL = 12; // rem — sticky Objektspalte

/** Verfügbarkeit in CHUNK-Blöcken laden (langer Range in einem Call vermeiden).
 *  Fehler werden PROPAGIERT — ein stilles [] würde gebuchte Tage als frei
 *  zeigen (Keine-Fallbacks-Regel). */
async function loadAvailabilityChunked(
  propertyId: string,
  from: string,
  to: string,
): Promise<{ days: DayAvailability[]; error: string | null }> {
  const calls: Promise<Awaited<ReturnType<typeof getAvailability>>>[] = [];
  for (let s = from; s < to; s = isoPlus(s, CHUNK)) {
    const e = isoPlus(s, CHUNK) < to ? isoPlus(s, CHUNK) : to;
    calls.push(getAvailability(propertyId, s, e));
  }
  const results = await Promise.all(calls);
  const failed = results.find((r) => !r.ok);
  return {
    days: results.flatMap((r) => (r.ok ? r.data : [])),
    error: failed && !failed.ok ? failed.error : null,
  };
}

export function StopSellCalendar({
  properties,
  agencies,
  agenciesError = null,
}: {
  properties: Property[];
  agencies: AgencyOption[];
  /** Ladefehler der Partner-Liste — sichtbar machen statt leeres Select. */
  agenciesError?: string | null;
}) {
  const t = useTranslations("stopSell");
  const locale = useLocale();
  const today = useMemo(todayIso, []);
  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => isoPlus(today, i)),
    [today],
  );

  const [avail, setAvail] = useState<Record<string, Record<string, DayAvailability>>>({});
  const [stops, setStops] = useState<Record<string, Record<string, StopSellDay>>>({});
  // Buchungen je Objekt × Nacht: gebuchte Tage werden als Buchung (Gastname)
  // gezeigt, nicht als anonymes Stop-Sell-Schloss — Stop-Sell und Kalender
  // müssen dieselbe Belegungs-Wahrheit zeigen.
  const [resByDay, setResByDay] = useState<Record<string, Record<string, Reservation>>>({});
  const [error, setError] = useState<string | null>(agenciesError);
  // Fehler-Prop nach Realtime-Refresh übernehmen — sonst bliebe ein alter
  // Banner stehen (oder ein neuer Ladefehler unsichtbar).
  useEffect(() => {
    setError(agenciesError);
  }, [agenciesError]);
  // Drag: Anker + aktueller Tag innerhalb EINER Objektzeile.
  const [drag, setDrag] = useState<{ pid: string; a: string; b: string } | null>(null);
  const [sel, setSel] = useState<StopSellSelection | null>(null);

  const load = useCallback(async () => {
    const to = isoPlus(today, DAYS_AHEAD);
    // Buchungen tenant-weit EINMAL laden (dieselbe Action wie der Belegungsplan,
    // liefert Gastname per GuestMask) und je Objekt nach Nacht zuordnen.
    const resAll = await listReservations();
    if (!resAll.ok) setError(resAll.error);
    const resByProp: Record<string, Record<string, Reservation>> = {};
    if (resAll.ok) {
      for (const r of resAll.data.items) {
        if (r.status === "cancelled") continue; // stornierte belegen nicht
        const map = (resByProp[r.property_id] ??= {});
        // Nächte: check_in (inkl.) bis check_out (exkl.).
        for (let d = r.check_in; d < r.check_out; d = isoPlus(d, 1)) map[d] = r;
      }
    }
    const perProperty = await Promise.all(
      properties.map(async (p) => {
        const [availRes, stopRes] = await Promise.all([
          loadAvailabilityChunked(p.id, today, to),
          listStopSell(p.id, today, to),
        ]);
        if (availRes.error) setError(availRes.error);
        if (!stopRes.ok) setError(stopRes.error);
        const availMap: Record<string, DayAvailability> = {};
        for (const d of availRes.days) availMap[d.date] = d;
        const stopMap: Record<string, StopSellDay> = {};
        if (stopRes.ok) for (const s of stopRes.data.items) stopMap[s.date] = s;
        return [p.id, availMap, stopMap] as const;
      }),
    );
    setAvail(Object.fromEntries(perProperty.map(([id, a]) => [id, a])));
    setStops(Object.fromEntries(perProperty.map(([id, , s]) => [id, s])));
    setResByDay(resByProp);
  }, [properties, today]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: Stopps (auch Channex-Importe), Belegung und Buchungen ohne Reload.
  // Während eines Drags pausieren, damit die Auswahl nicht springt.
  useRealtime({ table: "stop_sell", onChange: load, enabled: !drag });
  useRealtime({ table: "availability", onChange: load, enabled: !drag });
  useRealtime({ table: "reservations", onChange: load, enabled: !drag });

  // Drag endet mit globalem mouseup → Auswahl normalisieren, Panel öffnen.
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      setDrag(null);
      const [start, end] = drag.a <= drag.b ? [drag.a, drag.b] : [drag.b, drag.a];
      const prop = properties.find((p) => p.id === drag.pid);
      if (prop) {
        setSel({ propertyId: prop.id, propertyTitle: prop.title, start, end });
      }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [drag, properties]);

  // Kopfzeilen: Monatsblöcke + Tageszeile, lokalisiert über Intl.
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }),
    [locale],
  );
  const months = useMemo(() => {
    const out: { key: string; label: string; span: number }[] = [];
    for (const d of days) {
      const key = d.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === key) last.span += 1;
      else out.push({ key, label: monthFmt.format(new Date(d + "T00:00:00Z")), span: 1 });
    }
    return out;
  }, [days, monthFmt]);

  const active = drag
    ? {
      pid: drag.pid,
      start: drag.a <= drag.b ? drag.a : drag.b,
      end: drag.a <= drag.b ? drag.b : drag.a,
    }
    : sel
      ? { pid: sel.propertyId, start: sel.start, end: sel.end }
      : null;

  // Ein Tag gilt als gebucht, wenn availability=booked ODER eine (nicht
  // stornierte) Reservierung darauf liegt — beide Quellen zusammen, damit ein
  // Sync-Verzug nie eine Buchung verschwinden lässt.
  const isBooked = (pid: string, d: string): boolean =>
    avail[pid]?.[d]?.status === "booked" || !!resByDay[pid]?.[d];

  function cellClasses(pid: string, d: string): string {
    const inSelection =
      !!active && active.pid === pid && d >= active.start && d <= active.end;
    if (inSelection) return "bg-foreground/80";
    // Buchung sticht Stop-Sell (der Tag ist verkauft) — wie im Belegungsplan.
    if (isBooked(pid, d)) return "bg-accent/70";
    const day = avail[pid]?.[d];
    const stop = stops[pid]?.[d];
    if (stop) return stop.source === "channex" ? "bg-destructive/10" : "bg-destructive/20";
    if (day?.status === "blocked") return "bg-muted-foreground/40";
    const wd = isoWeekday(d);
    return wd >= 5 ? "bg-muted/60" : "bg-background";
  }

  function cellTitle(p: Property, d: string): string {
    const day = avail[p.id]?.[d];
    const stop = stops[p.id]?.[d];
    const res = resByDay[p.id]?.[d];
    const parts = [p.title, d];
    if (isBooked(p.id, d)) {
      // Gastname sichtbar machen (Stop-Sell muss die Buchung zeigen).
      parts.push(res?.guest_name ? `${t("legendBooked")}: ${res.guest_name}` : t("legendBooked"));
    } else if (day?.status === "blocked") parts.push(t("legendBlocked"));
    else parts.push(t("legendOpen"));
    // Stop-Sell nur ergänzen, wenn der Tag NICHT gebucht ist (sonst irreführend).
    if (stop && !isBooked(p.id, d)) {
      parts.push(stop.source === "channex" ? t("legendStopChannel") : t("legendStopManual"));
      if (stop.reason) parts.push(stop.reason);
    }
    return parts.join(" · ");
  }

  const stopsFor = (pid: string): StopSellDay[] => Object.values(stops[pid] ?? {});

  // Gebuchte Tage eines Objekts (availability=booked ∪ Reservierungsnächte) —
  // fürs Panel, damit gebuchte Tage aus der wirksamen Auswahl fallen.
  const bookedDatesFor = (pid: string): Set<string> => {
    const set = new Set<string>(Object.keys(resByDay[pid] ?? {}));
    for (const [d, day] of Object.entries(avail[pid] ?? {})) {
      if (day.status === "booked") set.add(d);
    }
    return set;
  };

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[2px] border border-border bg-background" />
          {t("legendOpen")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[2px] bg-accent/70" />
          {t("legendBooked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[2px] bg-muted-foreground/40" />
          {t("legendBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:hand-palm" className="size-3.5 text-destructive" />
          {t("legendStopManual")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:lock-simple" className="size-3.5 text-destructive/70" />
          {t("legendStopChannel")}
        </span>
        <span className="ml-auto hidden text-muted-foreground/80 sm:inline">
          {t("calendarHint")}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Kalender-Raster */}
        <div className="min-w-0 flex-1 overflow-auto rounded-(--radius) border border-border bg-background select-none">
          <div style={{ width: `${LABEL + days.length * COL}rem` }}>
            {/* Kopf 1: Monate */}
            <div className="sticky top-0 z-20 flex border-b border-border bg-background">
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-border bg-background"
                style={{ width: `${LABEL}rem` }}
              />
              {months.map((m) => (
                <div
                  key={m.key}
                  className="border-r border-border px-2 py-1 text-xs font-semibold"
                  style={{ width: `${m.span * COL}rem` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            {/* Kopf 2: Tage */}
            <div className="sticky top-6 z-20 flex border-b border-border bg-background">
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center border-r border-border bg-background px-3 text-xs font-medium text-muted-foreground"
                style={{ width: `${LABEL}rem` }}
              >
                {t("property")}
              </div>
              {days.map((d) => (
                <div
                  key={d}
                  className={
                    "flex shrink-0 flex-col items-center justify-center py-1 text-[0.625rem] leading-tight " +
                    (d === today
                      ? "rounded-t-sm bg-accent text-accent-foreground"
                      : isoWeekday(d) >= 5
                        ? "bg-muted/60 text-muted-foreground"
                        : "text-muted-foreground")
                  }
                  style={{ width: `${COL}rem` }}
                >
                  <span>{weekdayFmt.format(new Date(d + "T00:00:00Z"))}</span>
                  <span className="font-semibold text-foreground">
                    {parseInt(d.slice(8), 10)}
                  </span>
                </div>
              ))}
            </div>
            {/* Objektzeilen */}
            {properties.map((p) => (
              <div key={p.id} className="flex border-b border-border last:border-b-0">
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center truncate border-r border-border bg-background px-3 text-sm font-medium"
                  style={{ width: `${LABEL}rem`, height: `${ROW}rem` }}
                  title={p.title}
                >
                  <span className="truncate">{p.title}</span>
                </div>
                {days.map((d) => {
                  const stop = stops[p.id]?.[d];
                  const booked = isBooked(p.id, d);
                  const inSel =
                    !!active && active.pid === p.id && d >= active.start && d <= active.end;
                  return (
                    <button
                      key={d}
                      type="button"
                      title={cellTitle(p, d)}
                      // Gebuchte Tage sind für Stop-Sell tabu → nicht auswählbar.
                      disabled={booked}
                      onMouseDown={(e) => {
                        if (e.button !== 0 || booked) return;
                        e.preventDefault();
                        setSel(null);
                        setDrag({ pid: p.id, a: d, b: d });
                      }}
                      onMouseEnter={() => {
                        if (booked) return;
                        setDrag((prev) =>
                          prev && prev.pid === p.id ? { ...prev, b: d } : prev,
                        );
                      }}
                      className={
                        "flex shrink-0 items-center justify-center border-r border-border/50 transition-colors " +
                        (booked ? "cursor-not-allowed " : "") +
                        cellClasses(p.id, d)
                      }
                      style={{ width: `${COL}rem`, height: `${ROW}rem` }}
                    >
                      {/* Stop-Sell-Schloss nur auf NICHT gebuchten Tagen zeigen. */}
                      {stop && !booked ? (
                        <Icon
                          icon={stop.source === "channex" ? "ph:lock-simple" : "ph:hand-palm"}
                          className={
                            "size-3.5 " +
                            (inSel
                              ? "text-background"
                              : stop.source === "channex"
                                ? "text-destructive/70"
                                : "text-destructive")
                          }
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Seiten-Panel nach Auswahl (Konvergenzmuster: Panel statt Modal) */}
        {sel ? (
          <StopSellPanel
            selection={sel}
            stops={stopsFor(sel.propertyId)}
            bookedDates={bookedDatesFor(sel.propertyId)}
            agencies={agencies}
            onClose={() => setSel(null)}
            onDone={() => {
              setSel(null);
              load();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
