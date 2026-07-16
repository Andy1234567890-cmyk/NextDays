"use client";

// Kalender-Ansicht „Preise" (Hotel-Rate-Grid): pro Zimmerkategorie eine Zeile je
// Rate-Plan mit den ECHTEN Tagespreisen (Datumspreis > Objekt-Override > Dynamic
// > Wochentag > Plan-Grundpreis) — dieselbe Wahrheit wie Buchungs-Quote und
// Portale (/rates/grid, zentraler Resolver). Branchenmuster (Booking-Extranet,
// SiteMinder): Kategorie-Kopf → Plan-Zeilen, Ziehen über Tage → kleiner
// Bulk-Editor (Preis setzen / auf Grundpreis zurück), Umschalter Preise|Min-Stay.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Prop } from "@/components/kalender/calendar-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { formatCurrency } from "@/lib/currency";
import {
  getRateGrid,
  listRatePlanMinStays,
  listRatePlanRestrictions,
  resyncRatePlanPrices,
  setRatePlanMinStays,
  setRatePlanPrices,
  setRatePlanRestrictions,
  type RateGridResponse,
  type RatePlanMinStayDay,
  type RatePlanRestrictionDay,
} from "@/lib/rates";
import { useRealtime } from "@/lib/use-realtime";

const WD_KEYS = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;
// Gleiche Geometrie wie der Belegungsplan (calendar-board) — die Ansicht soll
// sich wie eine zweite Seite DESSELBEN Kalenders anfühlen, nicht wie eine Tabelle.
const COL = 5.5; // rem pro Tagesspalte
const LABEL = 17; // rem für die Plan-Spalte

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysIso(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

type Mode = "prices" | "minstay" | "restrictions";
// Drei-Wege-Auswahl im Restriktions-Editor: unverändert lassen gibt es hier
// nicht — "none" heißt „kein Override" (Default offen).
type TriState = "none" | "on" | "off";

export function CalendarRatesView({ properties }: { properties: Prop[] }) {
  const t = useTranslations("calendar");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [grid, setGrid] = useState<RateGridResponse | null>(null);
  const todayKey = iso(new Date());
  const [minStays, setMinStays] = useState<Map<string, Map<string, number>>>(
    new Map(),
  );
  // Gesetzte Restriktionen (CTA/CTD/Max-Stay) je Plan × Datum (0153) — die
  // Anzeige-Wahrheit für den Restriktions-Modus, live per Realtime.
  const [restr, setRestr] = useState<
    Map<string, Map<string, RatePlanRestrictionDay>>
  >(new Map());
  const [mode, setMode] = useState<Mode>("prices");
  const [busy, setBusy] = useState(false);

  // Monatsfenster [first, firstNext) — /rates/grid ist range-begrenzt.
  const first = useMemo(
    () => iso(new Date(Date.UTC(cursor.year, cursor.month, 1))),
    [cursor],
  );
  const firstNext = useMemo(
    () => iso(new Date(Date.UTC(cursor.year, cursor.month + 1, 1))),
    [cursor],
  );
  const days = useMemo(() => {
    const out: string[] = [];
    let cur = first;
    while (cur < firstNext) {
      out.push(cur);
      cur = addDaysIso(cur, 1);
    }
    return out;
  }, [first, firstNext]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    const res = await getRateGrid(propertyId, first, firstNext);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setGrid(res.data);
    // Min-Stay- und Restriktions-Overrides je Plan (kleine Listen; Anzeige =
    // Override ?? Default) — parallel geladen.
    const planIds = res.data.room_types.flatMap((rt) => rt.plans.map((p) => p.id));
    const loaded = await Promise.all(
      planIds.map(async (id) => {
        const [ms, rs] = await Promise.all([
          listRatePlanMinStays(id),
          listRatePlanRestrictions(id),
        ]);
        const map = new Map<string, number>();
        if (ms.ok) {
          for (const d of ms.data.items as RatePlanMinStayDay[]) {
            map.set(d.date, d.min_stay);
          }
        }
        const rmap = new Map<string, RatePlanRestrictionDay>();
        if (rs.ok) {
          for (const d of rs.data.items) rmap.set(d.date, d);
        }
        return [id, map, rmap] as const;
      }),
    );
    setMinStays(new Map(loaded.map(([id, ms]) => [id, ms])));
    setRestr(new Map(loaded.map(([id, , rs]) => [id, rs])));
  }, [propertyId, first, firstNext]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime auf ALLE speisenden Tabellen (Preise, Min-Stay, Pläne, Sync,
  // Kategorien) — kein manuelles Reload nötig.
  const reload = useCallback(() => void load(), [load]);
  useRealtime({ table: "rate_plan_price_overrides", onChange: reload });
  useRealtime({ table: "rate_plan_min_stay_overrides", onChange: reload });
  useRealtime({ table: "rate_plan_restriction_overrides", onChange: reload });
  useRealtime({ table: "rate_plans", onChange: reload });
  useRealtime({ table: "rate_plan_sync_state", onChange: reload });
  useRealtime({ table: "room_types", onChange: reload });
  useRealtime({ table: "price_overrides", onChange: reload });
  useRealtime({ table: "dynamic_prices", onChange: reload });

  // Drag-Auswahl innerhalb EINER Plan-Zeile → Editor öffnen.
  const drag = useRef<{ planId: string; from: string; to: string } | null>(null);
  const [dragSel, setDragSel] = useState<{
    planId: string;
    from: string;
    to: string;
  } | null>(null);
  const [editor, setEditor] = useState<{
    planId: string;
    planName: string;
    currency: string;
    from: string;
    to: string; // inklusiv
  } | null>(null);
  const [value, setValue] = useState("");
  // Restriktions-Editor: CTA/CTD als Drei-Wege (kein Override / gesperrt / offen);
  // `value` trägt in diesem Modus den Max-Stay.
  const [ctaSel, setCtaSel] = useState<TriState>("none");
  const [ctdSel, setCtdSel] = useState<TriState>("none");

  const onDown = (planId: string, day: string) => {
    drag.current = { planId, from: day, to: day };
    setDragSel({ ...drag.current });
    setEditor(null);
  };
  const onEnter = (planId: string, day: string) => {
    if (!drag.current || drag.current.planId !== planId) return;
    drag.current = { ...drag.current, to: day };
    setDragSel({ ...drag.current });
  };
  useEffect(() => {
    const onUp = () => {
      const cur = drag.current;
      drag.current = null;
      if (!cur || !grid) return;
      const [lo, hi] = cur.from <= cur.to ? [cur.from, cur.to] : [cur.to, cur.from];
      const plan = grid.room_types
        .flatMap((rt) => rt.plans)
        .find((p) => p.id === cur.planId);
      if (!plan) return;
      setEditor({
        planId: plan.id,
        planName: plan.name,
        currency: plan.currency,
        from: lo,
        to: hi,
      });
      // Restriktions-Modus: Editor mit den AKTUELLEN Werten des ersten Tags
      // vorbefüllen — Nachträglich-Bearbeiten heißt sehen, was gesetzt ist.
      if (mode === "restrictions") {
        const cur = restr.get(plan.id)?.get(lo);
        setCtaSel(
          cur?.closed_to_arrival == null
            ? "none"
            : cur.closed_to_arrival
              ? "on"
              : "off",
        );
        setCtdSel(
          cur?.closed_to_departure == null
            ? "none"
            : cur.closed_to_departure
              ? "on"
              : "off",
        );
        setValue(cur?.max_stay != null ? String(cur.max_stay) : "");
      } else {
        setValue("");
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [grid, mode, restr]);

  const closeEditor = () => {
    setEditor(null);
    setDragSel(null);
    setValue("");
    setCtaSel("none");
    setCtdSel("none");
  };

  const apply = async (reset: boolean) => {
    if (!editor) return;
    const endExclusive = addDaysIso(editor.to, 1);
    if (mode === "restrictions") {
      // Endzustand senden: reset = alle drei null (Override zurücknehmen).
      let maxStay: number | null = null;
      if (!reset && value.trim() !== "") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) {
          toast.error(t("ratesView.invalidValue"));
          return;
        }
        maxStay = n;
      }
      setBusy(true);
      const res = await setRatePlanRestrictions(
        editor.planId, editor.from, endExclusive,
        reset
          ? { closed_to_arrival: null, closed_to_departure: null, max_stay: null }
          : {
            closed_to_arrival: ctaSel === "none" ? null : ctaSel === "on",
            closed_to_departure: ctdSel === "none" ? null : ctdSel === "on",
            max_stay: maxStay,
          },
      );
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      closeEditor();
      void load();
      return;
    }
    let num: number | null = null;
    if (!reset) {
      num = Number(value);
      const bad =
        value.trim() === "" ||
        !Number.isFinite(num) ||
        num < 0 ||
        (mode === "minstay" && (!Number.isInteger(num) || num < 1));
      if (bad) {
        toast.error(t("ratesView.invalidValue"));
        return;
      }
    }
    setBusy(true);
    const res =
      mode === "prices"
        ? await setRatePlanPrices(editor.planId, editor.from, endExclusive, num)
        : await setRatePlanMinStays(editor.planId, editor.from, endExclusive, num);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    closeEditor();
    void load();
  };

  const resync = async (planId: string) => {
    const res = await resyncRatePlanPrices(planId);
    if (!res.ok) toast.error(res.error);
    else toast.success(t("ratesView.resyncQueued"));
  };

  const goMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  const inDrag = (planId: string, day: string): boolean => {
    if (!dragSel || dragSel.planId !== planId) return false;
    const [lo, hi] =
      dragSel.from <= dragSel.to
        ? [dragSel.from, dragSel.to]
        : [dragSel.to, dragSel.from];
    return day >= lo && day <= hi;
  };

  const monthLabel = `${t(`calendarBoard.months.${(["januar", "februar", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"] as const)[cursor.month]}`)} ${cursor.year}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopfzeile: Objekt, Monat, Modus. */}
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          aria-label={t("ratesView.propertyLabel")}
          className="h-9 w-auto rounded-full font-medium"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
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
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v as Mode);
            closeEditor();
          }}
          options={[
            { value: "prices", label: t("ratesView.modePrices") },
            { value: "minstay", label: t("ratesView.modeMinStay") },
            { value: "restrictions", label: t("ratesView.modeRestrictions") },
          ]}
        />
      </div>

      {/* Bulk-Editor der aufgezogenen Auswahl (Booking-Muster: Zeitraum + Wert). */}
      {editor && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
          <span className="text-sm font-medium">{editor.planName}</span>
          <span className="text-sm text-muted-foreground">
            {editor.from} – {editor.to}
          </span>
          {mode === "restrictions" ? (
            <>
              {/* CTA/CTD als Drei-Wege (— = kein Override, An = gesperrt, Aus =
                  ausdrücklich offen) + Max-Stay. Vorbefüllt mit den aktuellen
                  Werten — ändern überschreibt, „Zurücknehmen" löscht den Override. */}
              <span className="flex items-center gap-1.5 text-sm">
                <Icon icon="ph:sign-in" className="size-4 text-muted-foreground" />
                {t("monthGridView.arrivalBlocked")}
              </span>
              <Segmented
                value={ctaSel}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: t("ratesView.on") },
                  { value: "off", label: t("ratesView.off") },
                ]}
                onChange={(v) => setCtaSel(v as TriState)}
              />
              <span className="flex items-center gap-1.5 text-sm">
                <Icon icon="ph:sign-out" className="size-4 text-muted-foreground" />
                {t("monthGridView.departureBlocked")}
              </span>
              <Segmented
                value={ctdSel}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: t("ratesView.on") },
                  { value: "off", label: t("ratesView.off") },
                ]}
                onChange={(v) => setCtdSel(v as TriState)}
              />
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder={t("ratesView.maxStayLabel")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-36"
              />
            </>
          ) : (
            <Input
              type="number"
              min={mode === "minstay" ? 1 : 0}
              step={mode === "minstay" ? 1 : "0.01"}
              inputMode="decimal"
              autoFocus
              placeholder={
                mode === "prices"
                  ? t("ratesView.pricePlaceholder", { currency: editor.currency })
                  : t("ratesView.minStayPlaceholder")
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-44"
            />
          )}
          <Button size="sm" onClick={() => void apply(false)} disabled={busy}>
            {t("ratesView.apply")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void apply(true)}
            disabled={busy}
          >
            {mode === "prices"
              ? t("ratesView.resetToBase")
              : t("ratesView.resetToDefault")}
          </Button>
          <Button size="sm" variant="ghost" onClick={closeEditor} disabled={busy}>
            {t("ratesView.cancel")}
          </Button>
        </div>
      )}

      {/* Grid in der Design-Sprache des Belegungsplans: sticky Plan-Spalte,
          Tagesspalten in Board-Geometrie, Heute im Akzent-Kreis. */}
      <div className="overflow-x-auto rounded-(--radius) border bg-card">
        <div style={{ width: `${LABEL + days.length * COL}rem` }}>
          <div className="flex border-b">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ width: `${LABEL}rem` }}
            >
              {t("ratesView.planColumn")}
            </div>
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00Z`);
              const isToday = d === todayKey;
              return (
                <div
                  key={d}
                  className="flex shrink-0 flex-col items-center border-r py-2 text-sm"
                  style={{ width: `${COL}rem` }}
                >
                  <span className="text-xs text-muted-foreground">
                    {t(`calendarBoard.weekdays.${WD_KEYS[dt.getUTCDay()]}`)}
                  </span>
                  <span
                    className={`mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold ${
                      isToday ? "bg-accent text-white" : ""
                    }`}
                  >
                    {dt.getUTCDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {grid?.room_types.map((rt) => (
            <RoomTypeRows
              key={rt.id}
              roomType={rt}
              days={days}
              mode={mode}
              minStays={minStays}
              restrictions={restr}
              inDrag={inDrag}
              onDown={onDown}
              onEnter={onEnter}
              onResync={(id) => void resync(id)}
            />
          ))}
        </div>
        {grid && grid.room_types.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("ratesView.empty")}
          </p>
        )}
        {!grid && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("calendarViews.loading")}
          </p>
        )}
      </div>
    </div>
  );
}

function RoomTypeRows({
  roomType,
  days,
  mode,
  minStays,
  restrictions,
  inDrag,
  onDown,
  onEnter,
  onResync,
}: {
  roomType: { id: string; title: string; plans: RateGridResponse["room_types"][number]["plans"] };
  days: string[];
  mode: Mode;
  minStays: Map<string, Map<string, number>>;
  restrictions: Map<string, Map<string, RatePlanRestrictionDay>>;
  inDrag: (planId: string, day: string) => boolean;
  onDown: (planId: string, day: string) => void;
  onEnter: (planId: string, day: string) => void;
  onResync: (planId: string) => void;
}) {
  const t = useTranslations("calendar");
  return (
    <>
      {/* Kategorie-Kopf (Branchenmuster: diese Ebene zeigt KEINEN Preis) —
          durchgehendes Band, Spaltenlinien laufen weiter. */}
      <div className="flex border-b bg-secondary/40">
        <div
          className="sticky left-0 z-20 shrink-0 border-r bg-secondary/40 px-4 py-1.5 text-sm font-semibold backdrop-blur"
          style={{ width: `${LABEL}rem` }}
        >
          {roomType.title}
        </div>
        {days.map((d) => (
          <div
            key={d}
            className="shrink-0 border-r"
            style={{ width: `${COL}rem` }}
          />
        ))}
      </div>
      {roomType.plans.map((plan) => {
        const byDate = new Map(plan.days.map((d) => [d.date, d]));
        const ms = minStays.get(plan.id);
        const rs = restrictions.get(plan.id);
        return (
          <div key={plan.id} className="flex border-b last:border-b-0">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card px-4 py-2"
              style={{ width: `${LABEL}rem` }}
            >
              <span className="truncate text-sm font-medium">{plan.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatCurrency(plan.base_price, plan.currency)}
              </span>
              {plan.sync_status === "pending" && (
                <button
                  type="button"
                  onClick={() => onResync(plan.id)}
                  title={t("ratesView.resyncTitle")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                >
                  <Icon icon="ph:clock-countdown" className="size-3.5" />
                  {t("ratesView.syncPending")}
                </button>
              )}
              {plan.sync_status === "synced" && (
                <span
                  title={t("ratesView.syncSynced")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                >
                  <Icon icon="ph:check-circle" className="size-3.5" />
                </span>
              )}
            </div>
            {days.map((day) => {
              const cell = byDate.get(day);
              const isOverride = cell?.source === "rate_plan";
              const selected = inDrag(plan.id, day);
              const msOverride = ms?.get(day);
              const rsDay = rs?.get(day);
              const hasRestriction =
                rsDay != null &&
                (rsDay.closed_to_arrival != null ||
                  rsDay.closed_to_departure != null ||
                  rsDay.max_stay != null);
              // Gleiche Preisdarstellung wie der Belegungsplan: Währung + zwei
              // Nachkommastellen („100,00 $"), nie nackte Zahlen.
              const shown =
                mode === "prices"
                  ? cell?.price != null
                    ? formatCurrency(cell.price, plan.currency)
                    : "—"
                  : String(msOverride ?? plan.min_stay);
              const overrideCell =
                mode === "prices"
                  ? isOverride
                  : mode === "minstay"
                    ? msOverride != null
                    : hasRestriction;
              const restrTitle = hasRestriction
                ? [
                  rsDay?.closed_to_arrival
                    ? t("monthGridView.arrivalBlocked")
                    : null,
                  rsDay?.closed_to_departure
                    ? t("monthGridView.departureBlocked")
                    : null,
                  rsDay?.max_stay != null
                    ? `${t("ratesView.maxStayLabel")}: ${rsDay.max_stay}`
                    : null,
                ].filter(Boolean).join(" · ")
                : undefined;
              return (
                <button
                  key={day}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onDown(plan.id, day);
                  }}
                  onMouseEnter={() => onEnter(plan.id, day)}
                  title={
                    mode === "prices" && cell
                      ? t(`ratesView.source.${cell.source}`)
                      : mode === "restrictions"
                        ? restrTitle
                        : undefined
                  }
                  className={`flex shrink-0 select-none items-center justify-center gap-0.5 border-r py-2 text-sm tabular-nums transition-colors ${
                    selected
                      ? "outline outline-2 -outline-offset-2 outline-accent"
                      : ""
                  } ${
                    overrideCell
                      ? "bg-accent/10 font-semibold text-accent"
                      : "hover:bg-secondary/60"
                  } ${
                    mode === "minstay" && msOverride == null
                      ? "text-muted-foreground"
                      : ""
                  }`}
                  style={{ width: `${COL}rem` }}
                >
                  {mode === "restrictions" ? (
                    hasRestriction ? (
                      <>
                        {/* Sprachneutrale Kompaktdarstellung: ⇥ Anreise, ⇤ Abreise
                            gesperrt, ≤n Max-Stay — Details im Tooltip. */}
                        {rsDay?.closed_to_arrival ? (
                          <Icon icon="ph:sign-in" className="size-4 text-destructive" />
                        ) : null}
                        {rsDay?.closed_to_departure ? (
                          <Icon icon="ph:sign-out" className="size-4 text-destructive" />
                        ) : null}
                        {rsDay?.max_stay != null ? (
                          <span className="text-xs">≤{rsDay.max_stay}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  ) : (
                    shown
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
