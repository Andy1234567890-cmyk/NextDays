"use client";

// Datumsgenaue Preise EINES Rate-Plans (Hotel: Twin/BAR und Double/B&B können am
// selben Tag verschieden sein). Monatsgitter + Drag über die Tage → Zeitraum
// wählen, Preis eingeben, an genau diesen Rate-Plan gepusht (alle 3 Vertriebswege
// gleich). Doppelklick auf einen Tag mit Preis nimmt ihn zurück (Basispreis gilt
// wieder). Live via useRealtime auf rate_plan_price_overrides.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import {
  listRatePlanPrices,
  setRatePlanPrices,
  type RatePlanPriceDay,
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
// Wochentag-Index Mo=0 … So=6.
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function RatePlanPriceCalendar({
  ratePlanId,
  currency,
}: {
  ratePlanId: string;
  currency: string;
}) {
  const t = useTranslations("roomTypes");
  const months = t("months").split(",");
  const weekdays = t("weekdays").split(",");
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [priceInput, setPriceInput] = useState("");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ from: string; to: string } | null>(null);
  const [dragRange, setDragRange] = useState<{ from: string; to: string } | null>(null);

  const load = useCallback(async () => {
    const res = await listRatePlanPrices(ratePlanId);
    if (!res.ok) return;
    const map = new Map<string, number>();
    for (const p of res.data.items as RatePlanPriceDay[]) map.set(p.date, p.price);
    setPrices(map);
  }, [ratePlanId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: eigener Rate-Plan-Preistopf. Nur inkrementell neu laden — kein
  // Doppel-Reload-Pfad (der Push feuert postgres_changes).
  useRealtime({
    table: "rate_plan_price_overrides",
    filter: `rate_plan_id=eq.${ratePlanId}`,
    onChange: () => void load(),
  });

  // Tage der laufenden Drag-Auswahl (ISO, normalisiert lo..hi inklusiv).
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

  const applyPrice = useCallback(
    async (from: string, endExclusive: string, price: number | null) => {
      setBusy(true);
      const res = await setRatePlanPrices(ratePlanId, from, endExclusive, price);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // load() folgt über Realtime; optimistisch nichts erzwingen.
    },
    [ratePlanId],
  );

  // Drag-Ende: Preis auf den gewählten Zeitraum anwenden.
  useEffect(() => {
    const onUp = () => {
      const cur = drag.current;
      drag.current = null;
      if (!cur) return;
      const [lo, hi] = cur.from <= cur.to ? [cur.from, cur.to] : [cur.to, cur.from];
      setDragRange(null);
      const raw = priceInput.trim().replace(",", ".");
      const parsed = raw === "" ? null : Number(raw);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        toast.error(t("rpcPriceInvalid"));
        return;
      }
      void applyPrice(lo, addDays(hi, 1), parsed);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [priceInput, applyPrice, t]);

  // Doppelklick auf einen Tag mit Preis → zurücknehmen (Basispreis gilt wieder).
  const onDayDouble = (isoDate: string) => {
    if (!prices.has(isoDate)) return;
    void applyPrice(isoDate, addDays(isoDate, 1), null);
  };

  const selectedCount = dragDays.size;

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky Steuerleiste: Preis-Eingabe + Jahres-Navigation bleiben beim
          Scrollen durch die 12 Monate immer sichtbar. */}
      <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder={t("rpcPricePlaceholder", { currency: currency || "—" })}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-44"
          />
          {selectedCount > 0 && (
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-foreground">
              {t("rpcSelectedDays", { count: selectedCount })}
            </span>
          )}
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t("rpcHint")}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setYear((y) => y - 1)}
              disabled={busy}
            >
              <Icon icon="ph:caret-left" className="size-4" />
            </Button>
            <span className="min-w-16 text-center font-display text-xl font-bold">
              {year}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setYear((y) => y + 1)}
              disabled={busy}
            >
              <Icon icon="ph:caret-right" className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((label, m) => (
          <MonthGrid
            key={m}
            label={label}
            weekdays={weekdays}
            year={year}
            month={m}
            prices={prices}
            currency={currency}
            dragDays={dragDays}
            busy={busy}
            onDown={onDayDown}
            onEnter={onDayEnter}
            onDouble={onDayDouble}
          />
        ))}
      </div>
    </div>
  );
}

function MonthGrid({
  label,
  weekdays,
  year,
  month,
  prices,
  currency,
  dragDays,
  busy,
  onDown,
  onEnter,
  onDouble,
}: {
  label: string;
  weekdays: string[];
  year: number;
  month: number;
  prices: Map<string, number>;
  currency: string;
  dragDays: Set<string>;
  busy: boolean;
  onDown: (iso: string) => void;
  onEnter: (iso: string) => void;
  onDouble: (iso: string) => void;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = mondayIndex(first);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(Date.UTC(year, month, d))));

  return (
    <div className="rounded-lg border p-2">
      <div className="mb-1.5 text-center text-sm font-semibold">{label}</div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-medium text-muted-foreground">
        {weekdays.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((isoDate, i) => {
          if (isoDate === null) return <div key={`e${i}`} />;
          const price = prices.get(isoDate);
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
              title={price !== undefined ? formatCurrency(price, currency) : undefined}
              className={`flex min-h-12 w-full select-none flex-col items-center justify-center gap-0.5 overflow-hidden rounded px-0.5 py-1 text-xs transition-[outline] ${
                inDrag ? "outline outline-2 outline-accent outline-offset-1" : ""
              } ${
                price !== undefined
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span className="leading-none">{day}</span>
              {price !== undefined && (
                // Kompakt: reine Zahl ohne Symbol/Nachkomma (passt in die schmale
                // Zelle); voller Betrag inkl. Währung steht im title-Tooltip.
                <span className="w-full truncate text-center text-[0.6rem] leading-none tabular-nums">
                  {formatCurrency(price, null, "de-DE", 0)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
