"use client";

// Stop-Sell-Kalender in der Design-Sprache des Belegungsplans (Board-Geometrie:
// breite Tagesspalten, sticky Objektspalte, Monats-Navigation, Heute im
// Akzent-Kreis). Zwei Betriebsarten wie der Belegungsplan:
//   Ferienwohnung → eine Zeile pro Objekt (Stopp = Objekt-Ebene).
//   Hotel         → Zeilen pro Zimmerkategorie × Rate-Plan (Twin — BAR …);
//                   ein Stopp trifft GENAU diesen Plan (0152), ein Objekt-Stopp
//                   (Altdaten/FeWo-Pfad) wird auf allen Plan-Zeilen angezeigt.
// Drag über die Tage einer Zeile wählt einen Zeitraum → rechtes Seiten-Panel
// setzt/hebt den Stop-Sell (Portal-Stops read-only). Live per Realtime.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  getAvailability,
  listStopSell,
  resetStopSell,
  type DayAvailability,
  type StopSellDay,
} from "@/lib/calendar";
import { isoPlus, isoWeekday, todayIso } from "@/lib/dates";
import { getRateGrid } from "@/lib/rates";
import { listReservations, type Reservation } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

import {
  type AgencyOption,
  StopSellPanel,
  type StopSellSelection,
} from "./stop-sell-panel";

type Property = { id: string; title: string };

// Board-Geometrie des Belegungsplans — gleiche Maße, gleicher Look.
const COL = 5.5; // rem pro Tagesspalte
const LABEL = 17; // rem für die Objekt-/Plan-Spalte
const ROW_H = 3.5; // rem Zeilenhöhe

// Zeilenmodell: FeWo = Objektzeile; Hotel = Kategorie-Band + Plan-Zeilen.
type PlanRow = { planId: string; label: string };
type HotelStructure = {
  categories: { id: string; title: string; plans: PlanRow[] }[];
};

/** Verfügbarkeit blockweise laden — Fehler PROPAGIEREN (ein stilles [] würde
 *  gebuchte Tage als frei zeigen, Keine-Fallbacks-Regel). */
async function loadAvailability(
  propertyId: string,
  from: string,
  to: string,
): Promise<{ days: DayAvailability[]; error: string | null }> {
  const res = await getAvailability(propertyId, from, to);
  return res.ok
    ? { days: res.data, error: null }
    : { days: [], error: res.error };
}

/** ISO-Erster des Monats von `cursor` + Anzahl Tage des Monats. */
function monthWindow(year: number, month: number): { first: string; count: number } {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { first, count };
}

export function StopSellCalendar({
  properties,
  accommodationType,
  agencies,
  agenciesError = null,
}: {
  properties: Property[];
  // Betriebsart (wie CalendarViews): hotel → Kategorie×Plan-Zeilen.
  accommodationType?: "vacation_rental" | "hotel" | null;
  agencies: AgencyOption[];
  /** Ladefehler der Partner-Liste — sichtbar machen statt leeres Select. */
  agenciesError?: string | null;
}) {
  const t = useTranslations("stopSell");
  const locale = useLocale();
  const today = useMemo(todayIso, []);
  const isHotel = accommodationType === "hotel";

  // Monats-Navigation wie im Belegungsplan (Start: aktueller Monat).
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const { first, count } = monthWindow(cursor.year, cursor.month);
  const days = useMemo(
    () => Array.from({ length: count }, (_, i) => isoPlus(first, i)),
    [first, count],
  );
  const windowEnd = isoPlus(first, count); // exklusiv

  const goMonth = (delta: number) =>
    setCursor((c) => {
      const m = c.month + delta;
      return {
        year: c.year + Math.floor(m / 12),
        month: ((m % 12) + 12) % 12,
      };
    });

  const [avail, setAvail] = useState<Record<string, Record<string, DayAvailability>>>({});
  const [stops, setStops] = useState<Record<string, StopSellDay[]>>({});
  // Hotel: Kategorie×Plan-Struktur je Objekt (aus dem Rate-Grid, nur Struktur).
  const [structure, setStructure] = useState<Record<string, HotelStructure>>({});
  // Buchungen je Objekt × Nacht (Gastname im Tooltip — gleiche Wahrheit wie
  // der Belegungsplan). Nur für die Objekt-Ebene (FeWo) relevant.
  const [resByDay, setResByDay] = useState<Record<string, Record<string, Reservation>>>({});
  const [error, setError] = useState<string | null>(agenciesError);
  useEffect(() => {
    setError(agenciesError);
  }, [agenciesError]);

  // Drag: Anker + aktueller Tag innerhalb EINER Zeile (Objekt ODER Plan).
  const [drag, setDrag] = useState<
    { pid: string; planId: string | null; a: string; b: string } | null
  >(null);
  const [sel, setSel] = useState<StopSellSelection | null>(null);
  // „Alles zurücksetzen": Ziel (ein Objekt oder alle) + Doppel-Bestätigung.
  const [reset, setReset] = useState<
    { target: Property | null; confirmed: boolean } | null
  >(null);
  const [resetting, setResetting] = useState(false);

  async function runReset() {
    if (!reset) return;
    setResetting(true);
    setError(null);
    const res = await resetStopSell(reset.target?.id);
    setResetting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setReset(null);
    // Realtime (stop_sell-Abo) pflegt die Zellen nach — kein manuelles Reload.
  }

  const load = useCallback(async () => {
    // Buchungen tenant-weit EINMAL laden und je Objekt nach Nacht zuordnen.
    const resAll = await listReservations();
    if (!resAll.ok) setError(resAll.error);
    const resByProp: Record<string, Record<string, Reservation>> = {};
    if (resAll.ok) {
      for (const r of resAll.data.items) {
        if (r.status === "cancelled") continue; // stornierte belegen nicht
        const map = (resByProp[r.property_id] ??= {});
        for (let d = r.check_in; d < r.check_out; d = isoPlus(d, 1)) map[d] = r;
      }
    }
    const perProperty = await Promise.all(
      properties.map(async (p) => {
        const [availRes, stopRes] = await Promise.all([
          loadAvailability(p.id, first, windowEnd),
          listStopSell(p.id, first, windowEnd),
        ]);
        if (availRes.error) setError(availRes.error);
        if (!stopRes.ok) setError(stopRes.error);
        const availMap: Record<string, DayAvailability> = {};
        for (const d of availRes.days) availMap[d.date] = d;
        return [p.id, availMap, stopRes.ok ? stopRes.data.items : []] as const;
      }),
    );
    setAvail(Object.fromEntries(perProperty.map(([id, a]) => [id, a])));
    setStops(Object.fromEntries(perProperty.map(([id, , s]) => [id, s])));
    setResByDay(resByProp);
  }, [properties, first, windowEnd]);

  useEffect(() => {
    load();
  }, [load]);

  // Hotel: Kategorie×Plan-Struktur laden (Rate-Grid, 1-Tages-Fenster reicht —
  // es geht nur um die Struktur, nicht um Tageskurven).
  const loadStructure = useCallback(async () => {
    if (!isHotel) return;
    const entries = await Promise.all(
      properties.map(async (p) => {
        const res = await getRateGrid(p.id, today, isoPlus(today, 1));
        if (!res.ok) {
          setError(res.error);
          return [p.id, { categories: [] }] as const;
        }
        return [
          p.id,
          {
            categories: res.data.room_types.map((rt) => ({
              id: rt.id,
              title: rt.title,
              plans: rt.plans.map((pl) => ({
                planId: pl.id,
                label: pl.name,
              })),
            })),
          },
        ] as const;
      }),
    );
    setStructure(Object.fromEntries(entries));
  }, [isHotel, properties, today]);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  // Live: Stopps (auch Channex-Importe), Belegung, Buchungen und die Hotel-
  // Struktur (neue Kategorie/neuer Plan) ohne Reload. Drag pausiert die Abos,
  // damit die Auswahl nicht springt.
  useRealtime({ table: "stop_sell", onChange: load, enabled: !drag });
  useRealtime({ table: "availability", onChange: load, enabled: !drag });
  useRealtime({ table: "reservations", onChange: load, enabled: !drag });
  useRealtime({ table: "rate_plans", onChange: loadStructure, enabled: !drag });
  useRealtime({ table: "room_types", onChange: loadStructure, enabled: !drag });

  // Drag endet mit globalem mouseup → Auswahl normalisieren, Panel öffnen.
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      setDrag(null);
      const [start, end] = drag.a <= drag.b ? [drag.a, drag.b] : [drag.b, drag.a];
      const prop = properties.find((p) => p.id === drag.pid);
      if (!prop) return;
      let ratePlan: { id: string; label: string } | undefined;
      if (drag.planId) {
        for (const cat of structure[drag.pid]?.categories ?? []) {
          const plan = cat.plans.find((pl) => pl.planId === drag.planId);
          if (plan) {
            ratePlan = { id: plan.planId, label: `${cat.title} — ${plan.label}` };
            break;
          }
        }
      }
      setSel({ propertyId: prop.id, propertyTitle: prop.title, start, end, ratePlan });
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [drag, properties, structure]);

  // Kopf: Monats-Label + Wochentagskürzel, lokalisiert über Intl.
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
    [locale],
  );
  const monthLabel = monthFmt.format(new Date(`${first}T00:00:00Z`));

  const active = drag
    ? {
      pid: drag.pid,
      planId: drag.planId,
      start: drag.a <= drag.b ? drag.a : drag.b,
      end: drag.a <= drag.b ? drag.b : drag.a,
    }
    : sel
      ? {
        pid: sel.propertyId,
        planId: sel.ratePlan?.id ?? null,
        start: sel.start,
        end: sel.end,
      }
      : null;

  // Ein Tag gilt als gebucht (Objekt-Ebene), wenn availability=booked ODER eine
  // nicht stornierte Reservierung darauf liegt — beide Quellen zusammen.
  const isBooked = (pid: string, d: string): boolean =>
    avail[pid]?.[d]?.status === "booked" || !!resByDay[pid]?.[d];

  // Stopp einer Zeile am Tag: Plan-Zeile sieht ihren Plan UND Objekt-Stops
  // (rate_plan_id null gilt für alle Pläne); Objekt-Zeile nur Objekt-Stops.
  const stopAt = (pid: string, planId: string | null, d: string): StopSellDay | undefined =>
    (stops[pid] ?? []).find(
      (s) =>
        s.date === d &&
        (planId
          ? !s.rate_plan_id || s.rate_plan_id === planId
          : !s.rate_plan_id),
    );

  const inSelection = (pid: string, planId: string | null, d: string): boolean =>
    !!active &&
    active.pid === pid &&
    active.planId === planId &&
    d >= active.start &&
    d <= active.end;

  function cellClasses(pid: string, planId: string | null, d: string): string {
    if (inSelection(pid, planId, d)) return "bg-foreground/80";
    if (d < today) return "bg-muted/30"; // Vergangenheit: nur Anzeige
    // Objekt-Ebene: Buchung sticht Stop-Sell (der Tag ist verkauft).
    if (!planId && isBooked(pid, d)) return "bg-accent/70";
    const stop = stopAt(pid, planId, d);
    if (stop) return stop.source === "channex" ? "bg-destructive/10" : "bg-destructive/20";
    if (!planId && avail[pid]?.[d]?.status === "blocked") {
      return "bg-muted-foreground/40";
    }
    return isoWeekday(d) >= 5 ? "bg-muted/60" : "bg-background";
  }

  function cellTitle(p: Property, planId: string | null, planLabel: string | null, d: string): string {
    const stop = stopAt(p.id, planId, d);
    const res = resByDay[p.id]?.[d];
    const parts = [planLabel ? `${p.title} · ${planLabel}` : p.title, d];
    if (!planId && isBooked(p.id, d)) {
      parts.push(res?.guest_name ? `${t("legendBooked")}: ${res.guest_name}` : t("legendBooked"));
    } else if (!planId && avail[p.id]?.[d]?.status === "blocked") {
      parts.push(t("legendBlocked"));
    } else if (!stop) {
      parts.push(t("legendOpen"));
    }
    if (stop && !(planId === null && isBooked(p.id, d))) {
      parts.push(stop.source === "channex" ? t("legendStopChannel") : t("legendStopManual"));
      if (stop.reason) parts.push(stop.reason);
    }
    return parts.join(" · ");
  }

  // Panel-Daten: Stops der gewählten Ebene (Plan-Zeile → Plan + Objekt-Ebene).
  const stopsForSelection = (s: StopSellSelection): StopSellDay[] =>
    (stops[s.propertyId] ?? []).filter((row) =>
      s.ratePlan
        ? !row.rate_plan_id || row.rate_plan_id === s.ratePlan.id
        : !row.rate_plan_id,
    );

  // Gebuchte Tage (Objekt-Ebene) — fürs Panel; Plan-Zeilen haben keine binäre
  // Belegung (Kategorie zählt Zimmer), dort keine Buchungs-Sperre.
  const bookedDatesFor = (s: StopSellSelection): Set<string> => {
    if (s.ratePlan) return new Set();
    const set = new Set<string>(Object.keys(resByDay[s.propertyId] ?? {}));
    for (const [d, day] of Object.entries(avail[s.propertyId] ?? {})) {
      if (day.status === "booked") set.add(d);
    }
    return set;
  };

  // Eine Zeile Tageszellen (Objekt- oder Plan-Zeile) — identische Interaktion.
  const renderCells = (p: Property, planId: string | null, planLabel: string | null) =>
    days.map((d) => {
      const stop = stopAt(p.id, planId, d);
      const booked = !planId && isBooked(p.id, d);
      const past = d < today;
      const disabled = booked || past;
      return (
        <button
          key={d}
          type="button"
          title={cellTitle(p, planId, planLabel, d)}
          disabled={disabled}
          onMouseDown={(e) => {
            if (e.button !== 0 || disabled) return;
            e.preventDefault();
            setSel(null);
            setDrag({ pid: p.id, planId, a: d, b: d });
          }}
          onMouseEnter={() => {
            if (disabled) return;
            setDrag((prev) =>
              prev && prev.pid === p.id && prev.planId === planId
                ? { ...prev, b: d }
                : prev,
            );
          }}
          className={
            "flex shrink-0 items-center justify-center border-r transition-colors " +
            (disabled ? "cursor-not-allowed " : "") +
            cellClasses(p.id, planId, d)
          }
          style={{ width: `${COL}rem`, height: `${ROW_H}rem` }}
        >
          {stop && !booked ? (
            <Icon
              icon={stop.source === "channex" ? "ph:lock-simple" : "ph:hand-palm"}
              className={
                "size-4 " +
                (inSelection(p.id, planId, d)
                  ? "text-background"
                  : stop.source === "channex"
                    ? "text-destructive/70"
                    : "text-destructive")
              }
            />
          ) : null}
        </button>
      );
    });

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {/* Global: ALLE Stop-Sells aller Objekte zurücksetzen (Doppel-Bestätigung). */}
        <button
          type="button"
          onClick={() => setReset({ target: null, confirmed: false })}
          className="flex items-center gap-2 rounded-full border border-destructive px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          <Icon icon="ph:arrow-counter-clockwise" className="size-4" />
          {t("resetAll")}
        </button>
      </header>

      {/* Monats-Navigation (Board-Muster: Caret · Monatslabel · Caret). */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goMonth(-1)}>
          <Icon icon="ph:caret-left" className="size-4" />
        </Button>
        <span className="min-w-36 text-center font-display text-lg font-bold">
          {monthLabel}
        </span>
        <Button variant="outline" size="icon" onClick={() => goMonth(1)}>
          <Icon icon="ph:caret-right" className="size-4" />
        </Button>
      </div>

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
        {/* Kalender-Raster in Board-Geometrie */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-(--radius) border bg-card select-none">
          <div style={{ width: `${LABEL + days.length * COL}rem` }}>
            {/* Kopf: Wochentag + Tag, Heute im Akzent-Kreis (Board-Muster). */}
            <div className="flex border-b">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: `${LABEL}rem` }}
              >
                {t("property")}
              </div>
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00Z`);
                return (
                  <div
                    key={d}
                    className={
                      "flex shrink-0 flex-col items-center border-r py-2 text-sm" +
                      (isoWeekday(d) >= 5 ? " bg-muted/40" : "")
                    }
                    style={{ width: `${COL}rem` }}
                  >
                    <span className="text-xs text-muted-foreground">
                      {weekdayFmt.format(dt)}
                    </span>
                    <span
                      className={`mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold ${
                        d === today ? "bg-accent text-white" : ""
                      }`}
                    >
                      {dt.getUTCDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Zeilen: FeWo = Objekt; Hotel = Objekt-Band + Kategorie-Band +
                Plan-Zeilen (Zimmerkategorie × Rate-Plan). */}
            {properties.map((p) => (
              <div key={p.id}>
                {isHotel ? (
                  <>
                    {/* Objekt-Band (nicht interaktiv; Reset am Band). */}
                    <div className="flex border-b bg-secondary/60">
                      <div
                        className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r bg-secondary/60 px-4 py-1.5 text-sm font-semibold backdrop-blur"
                        style={{ width: `${LABEL}rem` }}
                        title={p.title}
                      >
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        {(stops[p.id]?.length ?? 0) > 0 && (
                          <ResetRowButton
                            label={t("resetProperty")}
                            onClick={() => setReset({ target: p, confirmed: false })}
                          />
                        )}
                      </div>
                      {days.map((d) => (
                        <div key={d} className="shrink-0 border-r" style={{ width: `${COL}rem` }} />
                      ))}
                    </div>
                    {(structure[p.id]?.categories ?? []).map((cat) => (
                      <div key={cat.id}>
                        {/* Kategorie-Band — Spaltenlinien laufen durch. */}
                        <div className="flex border-b bg-secondary/40">
                          <div
                            className="sticky left-0 z-10 shrink-0 border-r bg-secondary/40 px-4 py-1 text-xs font-semibold text-muted-foreground backdrop-blur"
                            style={{ width: `${LABEL}rem` }}
                          >
                            {cat.title}
                          </div>
                          {days.map((d) => (
                            <div key={d} className="shrink-0 border-r" style={{ width: `${COL}rem` }} />
                          ))}
                        </div>
                        {cat.plans.map((plan) => (
                          <div key={plan.planId} className="flex border-b last:border-b-0">
                            <div
                              className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-card pl-7 pr-4 text-sm font-medium"
                              style={{ width: `${LABEL}rem`, height: `${ROW_H}rem` }}
                              title={`${cat.title} — ${plan.label}`}
                            >
                              <span className="min-w-0 flex-1 truncate">{plan.label}</span>
                            </div>
                            {renderCells(p, plan.planId, `${cat.title} — ${plan.label}`)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex border-b last:border-b-0">
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r bg-card px-4 text-sm font-medium"
                      style={{ width: `${LABEL}rem`, height: `${ROW_H}rem` }}
                      title={p.title}
                    >
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {(stops[p.id]?.length ?? 0) > 0 && (
                        <ResetRowButton
                          label={t("resetProperty")}
                          onClick={() => setReset({ target: p, confirmed: false })}
                        />
                      )}
                    </div>
                    {renderCells(p, null, null)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Seiten-Panel nach Auswahl (Konvergenzmuster: Panel statt Modal) */}
        {sel ? (
          <StopSellPanel
            selection={sel}
            stops={stopsForSelection(sel)}
            bookedDates={bookedDatesFor(sel)}
            agencies={agencies}
            onClose={() => setSel(null)}
            onDone={() => {
              setSel(null);
              load();
            }}
          />
        ) : null}
      </div>

      {/* „Alles zurücksetzen" mit Doppel-Bestätigung: erst Warnung, dann ein
          zweiter, expliziter Klick löst das Löschen (auch Portal-Stops) aus. */}
      {reset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !resetting && setReset(null)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-(--radius) border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Icon icon="ph:warning" className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-base font-semibold">
                  {reset.target ? t("resetProperty") : t("resetAll")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {reset.target
                    ? t("resetPropertyWarn", { title: reset.target.title })
                    : t("resetAllWarn")}
                </p>
              </div>
            </div>

            {reset.confirmed && (
              <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {t("resetConfirmAgain")}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setReset(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              {!reset.confirmed ? (
                <button
                  type="button"
                  onClick={() => setReset({ ...reset, confirmed: true })}
                  className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90"
                >
                  {t("resetContinue")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={resetting}
                  onClick={runReset}
                  className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
                >
                  {resetting ? t("resetting") : t("resetConfirm")}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResetRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
    >
      <Icon icon="ph:arrow-counter-clockwise" className="size-3.5" />
    </button>
  );
}
