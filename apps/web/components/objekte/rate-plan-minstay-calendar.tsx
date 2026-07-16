"use client";

// Datumsgenauer Mindestaufenthalt EINES Rate-Plans (Hotel). Gleiche Drag-Mechanik
// wie der Datumspreis-Kalender: Wert eingeben, über die Tage ziehen, an genau
// diesen Rate-Plan gepusht (min_stay_arrival/through, alle 3 Vertriebswege gleich).
// Doppelklick auf einen Tag nimmt ihn zurück (Rate-Plan-Default gilt wieder).
// Live via useRealtime auf rate_plan_min_stay_overrides.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearAllRatePlanMinStays,
  listRatePlanMinStays,
  setRatePlanMinStays,
  type RatePlanMinStayDay,
} from "@/lib/rates";
import { useRealtime } from "@/lib/use-realtime";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function RatePlanMinStayCalendar({ ratePlanId }: { ratePlanId: string }) {
  const t = useTranslations("roomTypes");
  const months = t("months").split(",");
  const weekdays = t("weekdays").split(",");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [minStays, setMinStays] = useState<Map<string, number>>(new Map());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ from: string; to: string } | null>(null);
  const [dragRange, setDragRange] = useState<{ from: string; to: string } | null>(null);

  const load = useCallback(async () => {
    const res = await listRatePlanMinStays(ratePlanId);
    if (!res.ok) return;
    const map = new Map<string, number>();
    for (const m of res.data.items as RatePlanMinStayDay[]) map.set(m.date, m.min_stay);
    setMinStays(map);
  }, [ratePlanId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "rate_plan_min_stay_overrides",
    filter: `rate_plan_id=eq.${ratePlanId}`,
    onChange: () => void load(),
  });

  const dragDays = useMemo(() => {
    if (!dragRange) return new Set<string>();
    const [lo, hi] =
      dragRange.from <= dragRange.to
        ? [dragRange.from, dragRange.to]
        : [dragRange.to, dragRange.from];
    const out = new Set<string>();
    let cur = lo;
    while (cur <= hi) {
      out.add(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [dragRange]);

  const onDayDown = (isoDate: string) => {
    drag.current = { from: isoDate, to: isoDate };
    setDragRange({ from: isoDate, to: isoDate });
  };
  const onDayEnter = (isoDate: string) => {
    if (!drag.current) return;
    drag.current = { ...drag.current, to: isoDate };
    setDragRange({ ...drag.current });
  };

  const apply = useCallback(
    async (from: string, endExclusive: string, minStay: number | null) => {
      setBusy(true);
      const res = await setRatePlanMinStays(ratePlanId, from, endExclusive, minStay);
      setBusy(false);
      if (!res.ok) toast.error(res.error);
    },
    [ratePlanId],
  );

  useEffect(() => {
    const onUp = () => {
      const cur = drag.current;
      drag.current = null;
      if (!cur) return;
      const [lo, hi] = cur.from <= cur.to ? [cur.from, cur.to] : [cur.to, cur.from];
      setDragRange(null);
      const raw = input.trim();
      const parsed = raw === "" ? null : Number(raw);
      if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
        toast.error(t("msInvalid"));
        return;
      }
      void apply(lo, addDays(hi, 1), parsed);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [input, apply, t]);

  const onDayDouble = (isoDate: string) => {
    if (!minStays.has(isoDate)) return;
    void apply(isoDate, addDays(isoDate, 1), null);
  };

  const [confirmClear, setConfirmClear] = useState(false);
  const clearAll = useCallback(async () => {
    setBusy(true);
    const res = await clearAllRatePlanMinStays(ratePlanId);
    setBusy(false);
    setConfirmClear(false);
    if (!res.ok) toast.error(res.error);
  }, [ratePlanId]);

  const selectedCount = dragDays.size;
  const hasValues = minStays.size > 0;

  const goMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder={t("msPlaceholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-48"
            />
            {selectedCount > 0 && (
              <span className="whitespace-nowrap rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                {t("rpcSelectedDays", { count: selectedCount })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => goMonth(-1)}
              disabled={busy}
            >
              <Icon icon="ph:caret-left" className="size-4" />
            </Button>
            <span className="min-w-40 text-center font-display text-xl font-bold">
              {months[cursor.month]} {cursor.year}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => goMonth(1)}
              disabled={busy}
            >
              <Icon icon="ph:caret-right" className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t("msHint")}</p>
          {hasValues &&
            (confirmClear ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("msClearAllConfirm")}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={clearAll}
                  disabled={busy}
                >
                  {t("rpcClearAllYes")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                  disabled={busy}
                >
                  {t("cancel")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmClear(true)}
                disabled={busy}
              >
                <Icon icon="ph:trash" className="size-4" />
                {t("rpcClearAll")}
              </Button>
            ))}
        </div>
      </div>
      <BigMonth
        weekdays={weekdays}
        year={cursor.year}
        month={cursor.month}
        minStays={minStays}
        dragDays={dragDays}
        busy={busy}
        onDown={onDayDown}
        onEnter={onDayEnter}
        onDouble={onDayDouble}
        nightsLabel={t("msNights")}
      />
    </div>
  );
}

function BigMonth({
  weekdays,
  year,
  month,
  minStays,
  dragDays,
  busy,
  onDown,
  onEnter,
  onDouble,
  nightsLabel,
}: {
  weekdays: string[];
  year: number;
  month: number;
  minStays: Map<string, number>;
  dragDays: Set<string>;
  busy: boolean;
  onDown: (iso: string) => void;
  onEnter: (iso: string) => void;
  onDouble: (iso: string) => void;
  nightsLabel: string;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = mondayIndex(first);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(Date.UTC(year, month, d))));

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((isoDate, i) => {
          if (isoDate === null) return <div key={`e${i}`} />;
          const ms = minStays.get(isoDate);
          const inDrag = dragDays.has(isoDate);
          const day = Number(isoDate.slice(8, 10));
          return (
            <button
              key={isoDate}
              type="button"
              disabled={busy}
              onMouseDown={(e) => {
                e.preventDefault();
                onDown(isoDate);
              }}
              onMouseEnter={() => onEnter(isoDate)}
              onDoubleClick={() => onDouble(isoDate)}
              className={`flex min-h-16 w-full select-none flex-col items-start justify-start gap-1 rounded-md border p-1.5 text-sm transition-[outline] ${
                inDrag
                  ? "outline outline-2 outline-accent outline-offset-1"
                  : "border-border"
              } ${ms !== undefined ? "bg-accent/10" : "hover:bg-secondary"}`}
            >
              <span className="leading-none text-foreground">{day}</span>
              {ms !== undefined && (
                <span className="mt-auto w-full truncate text-xs font-semibold tabular-nums text-accent">
                  {ms} {nightsLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
