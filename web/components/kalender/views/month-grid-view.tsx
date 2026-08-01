"use client";

// Einzelobjekt-Monatsgitter (klassischer 7×N-Kalender wie Airbnb/Booking-Host):
// EIN Objekt, EIN Monat. Jede Zelle zeigt Status (frei/gebucht/gesperrt aus der
// availability), Tagespreis, Mindestaufenthalt und CTA/CTD-Sperren als Schloss-
// Icons. Objektauswahl + Monats-Navigation oben. Realtime auf den relevanten
// Tabellen (availability/reservations/price_overrides), kein Polling.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type DayAvailability,
  getAvailability,
} from "@/lib/calendar";
import { dateKey } from "@/lib/calendar-views";
import { formatCurrency } from "@/lib/utils";
import { getBoard } from "@/lib/calendar";
import { useRealtime } from "@/lib/use-realtime";

// Erster Gittertag (Montag der Woche, in der der Monatserste liegt) und Anzahl
// der 7er-Wochen für den Monat. Mo=0 … So=6.
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mo=0
  const d = new Date(first);
  d.setDate(first.getDate() - dow);
  return d;
}
function weeksInMonth(year: number, month: number): number {
  const start = gridStart(year, month);
  const lastDay = new Date(year, month + 1, 0);
  const diff = Math.round(
    (lastDay.getTime() - start.getTime()) / 86_400_000,
  );
  return Math.ceil((diff + 1) / 7);
}

export function CalendarMonthGridView({
  properties,
  initialPropertyId,
}: {
  properties: Prop[];
  initialPropertyId?: string | null;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const today = useMemo(() => new Date(), []);
  const [propertyId, setPropertyId] = useState<string>(
    initialPropertyId || properties[0]?.id || "",
  );
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth());

  const [days, setDays] = useState<Record<string, DayAvailability>>({});
  const [currency, setCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const todayKey = useMemo(() => dateKey(today), [today]);
  const start = useMemo(() => gridStart(year, month), [year, month]);
  const weeks = useMemo(() => weeksInMonth(year, month), [year, month]);

  const weekdays = useMemo(
    () => [
      t("monthGridView.weekdayMon"),
      t("monthGridView.weekdayTue"),
      t("monthGridView.weekdayWed"),
      t("monthGridView.weekdayThu"),
      t("monthGridView.weekdayFri"),
      t("monthGridView.weekdaySat"),
      t("monthGridView.weekdaySun"),
    ],
    [t],
  );
  const months = useMemo(
    () => [
      t("monthGridView.monthJanuary"),
      t("monthGridView.monthFebruary"),
      t("monthGridView.monthMarch"),
      t("monthGridView.monthApril"),
      t("monthGridView.monthMay"),
      t("monthGridView.monthJune"),
      t("monthGridView.monthJuly"),
      t("monthGridView.monthAugust"),
      t("monthGridView.monthSeptember"),
      t("monthGridView.monthOctober"),
      t("monthGridView.monthNovember"),
      t("monthGridView.monthDecember"),
    ],
    [t],
  );
  const statusCell = useMemo(
    (): Record<DayAvailability["status"], { cls: string; label: string }> => ({
      open: { cls: "bg-card", label: t("monthGridView.statusOpen") },
      booked: { cls: "bg-accent/15", label: t("monthGridView.statusBooked") },
      blocked: {
        cls: "bg-neutral-200 dark:bg-neutral-800",
        label: t("monthGridView.statusBlocked"),
      },
    }),
    [t],
  );

  const load = useCallback(async () => {
    if (!propertyId) {
      setDays({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const endExcl = new Date(start);
    endExcl.setDate(start.getDate() + weeks * 7);
    const startKey = dateKey(start);
    const endKey = dateKey(endExcl);

    const [av, board] = await Promise.all([
      getAvailability(propertyId, startKey, endKey),
      // Board liefert die Objekt-Währung aus dem Rate-Plan (zuverlässige
      // Preisquelle, unabhängig von Buchungen) — nicht mehr aus Reservierungen.
      getBoard([propertyId], startKey, endKey),
    ]);

    if (av.ok) {
      const map: Record<string, DayAvailability> = {};
      for (const d of av.data) map[d.date] = d;
      setDays(map);
    }
    if (board.ok) {
      const item = board.data.items.find((it) => it.property_id === propertyId);
      setCurrency(item?.currency ?? null);
    }
    setLoading(false);
  }, [propertyId, start, weeks]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime auf ALLE Tabellen, die den angezeigten Tagespreis + Min-Stay +
  // Belegung speisen (wie calendar-board) — sonst bleiben Preis/Min-Stay/Sperre
  // stale, bis der Nutzer den Monat wechselt (Realtime-Pflicht). Der Preis kommt
  // aus dem Resolver über price_overrides > dynamic_prices > weekday
  // (property_pricing_config) > base (rate_plans); dp_settings schaltet Dynamic
  // Pricing je Objekt; stop_sell beeinflusst die als 'blocked' gezeigte Belegung.
  useRealtime({ table: "availability", onChange: load });
  useRealtime({ table: "reservations", onChange: load });
  useRealtime({ table: "price_overrides", onChange: load });
  useRealtime({ table: "stop_sell", onChange: load });
  useRealtime({ table: "rate_plans", onChange: load });
  useRealtime({ table: "property_pricing_config", onChange: load });
  useRealtime({ table: "dynamic_prices", onChange: load });
  useRealtime({ table: "dp_settings", onChange: load });

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const cells = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < weeks * 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [start, weeks]);

  function priceText(price: number | null | undefined): string {
    if (price == null) return "–";
    return currency
      ? formatCurrency(price, currency)
      : price.toLocaleString(locale, { maximumFractionDigits: 0 });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Steuerung */}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="h-9 w-auto"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} aria-label={t("monthGridView.previousMonth")}>
            <Icon icon="ph:caret-left" className="size-4" />
          </Button>
          <span className="min-w-[9rem] text-center font-display text-lg font-bold">
            {months[month]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth} aria-label={t("monthGridView.nextMonth")}>
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
          <Button variant="outline" onClick={goToday}>
            {t("monthGridView.today")}
          </Button>
        </div>
      </div>

      <Card className="p-3">
        {/* Wochentagszeile */}
        <div className="grid grid-cols-7">
          {weekdays.map((w) => (
            <div
              key={w}
              className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>
        {/* Tageszellen */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const k = dateKey(d);
            const inMonth = d.getMonth() === month;
            const da = days[k];
            const status = da?.status ?? "open";
            const meta = statusCell[status];
            const isToday = k === todayKey;
            return (
              <div
                key={k}
                className={`flex min-h-[5rem] flex-col rounded-xl border p-1.5 ${
                  meta.cls
                } ${inMonth ? "" : "opacity-40"} ${
                  isToday ? "ring-2 ring-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday ? "text-accent" : ""}`}>
                    {d.getDate()}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {/* CTA = Anreise gesperrt, CTD = Abreise gesperrt. */}
                    {da?.closed_to_arrival && (
                      <span title={t("monthGridView.arrivalBlocked")} className="flex">
                        <Icon icon="ph:sign-in" className="size-3.5 text-destructive" />
                      </span>
                    )}
                    {da?.closed_to_departure && (
                      <span title={t("monthGridView.departureBlocked")} className="flex">
                        <Icon icon="ph:sign-out" className="size-3.5 text-destructive" />
                      </span>
                    )}
                  </span>
                </div>
                {da && (
                  <div className="mt-auto flex flex-col gap-0.5">
                    <span className="text-xs font-medium tabular-nums">
                      {priceText(da.price)}
                    </span>
                    <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground">
                      <span>{meta.label}</span>
                      {da.min_stay != null && da.min_stay > 1 && (
                        <span
                          title={t("monthGridView.minStayTitle", { count: da.min_stay })}
                        >
                          ≥{da.min_stay}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {loading && (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {t("monthGridView.loading")}
          </p>
        )}
      </Card>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border bg-card" /> {t("monthGridView.statusOpen")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-accent/15" /> {t("monthGridView.statusBooked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-neutral-200 dark:bg-neutral-800" />{" "}
          {t("monthGridView.statusBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-in" className="size-3.5 text-destructive" />{" "}
          {t("monthGridView.arrivalBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-out" className="size-3.5 text-destructive" />{" "}
          {t("monthGridView.departureBlocked")}
        </span>
      </div>
    </div>
  );
}
