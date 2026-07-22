"use client";

// Objekt-Kalender (.. „Kalender"): drei Monate nebeneinander, belegte
// Nächte dieses Objekts hervorgehoben. Ein Klick auf eine belegte Zelle öffnet
// die Buchungsdetailseite. Speist sich aus listReservations(propertyId); live
// über useRealtime auf reservations. Belegung = occupiesNight (Check-out-Tag frei).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { addDays, dateKey, occupiesNight } from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

// Zwölf Monate ab dem Anker sichtbar (ein Jahr Belegung im Blick, wie ..).
// Über die Kopf-Navigation verschiebt man das Fenster monats- oder jahresweise.
const VISIBLE_MONTHS = 12;

const WEEKDAY_KEYS = [
  "propertyCalendar.weekdayMon",
  "propertyCalendar.weekdayTue",
  "propertyCalendar.weekdayWed",
  "propertyCalendar.weekdayThu",
  "propertyCalendar.weekdayFri",
  "propertyCalendar.weekdaySat",
  "propertyCalendar.weekdaySun",
] as const;

const MONTH_NAME_KEYS = [
  "propertyCalendar.monthJanuary",
  "propertyCalendar.monthFebruary",
  "propertyCalendar.monthMarch",
  "propertyCalendar.monthApril",
  "propertyCalendar.monthMay",
  "propertyCalendar.monthJune",
  "propertyCalendar.monthJuly",
  "propertyCalendar.monthAugust",
  "propertyCalendar.monthSeptember",
  "propertyCalendar.monthOctober",
  "propertyCalendar.monthNovember",
  "propertyCalendar.monthDecember",
] as const;

// Erster Montag ≤ Monatsanfang (Mo-basiertes Raster).
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mo=0 … So=6
  return addDays(first, -dow);
}

export function PropertyCalendar({ propertyId }: { propertyId: string }) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  // Anker-Monat (erster der drei angezeigten Monate).
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const load = useCallback(async () => {
    const res = await listReservations(propertyId);
    if (res.ok) setReservations(res.data.items);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "reservations",
    filter: `property_id=eq.${propertyId}`,
    onChange: load,
  });

  // Buchung je belegtem Tag (für Klick → Detail). occupiesNight ignoriert Storno
  // und den Check-out-Tag (der ist wieder frei).
  const byDay = useMemo(() => {
    const map: Record<string, Reservation> = {};
    for (const r of reservations) {
      let d = new Date(`${r.check_in}T00:00:00`);
      const end = new Date(`${r.check_out}T00:00:00`);
      while (d < end) {
        const k = dateKey(d);
        if (occupiesNight(r, k)) map[k] = r;
        d = addDays(d, 1);
      }
    }
    return map;
  }, [reservations]);

  const months = useMemo(() => {
    const out: { year: number; month: number }[] = [];
    for (let i = 0; i < VISIBLE_MONTHS; i += 1) {
      const m = anchor.month + i;
      out.push({ year: anchor.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
    }
    return out;
  }, [anchor]);

  const shift = (delta: number) =>
    setAnchor((a) => {
      const m = a.month + delta;
      return { year: a.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const todayKey = dateKey(new Date());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">{t("propertyCalendar.title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-12)}
            aria-label={t("propertyCalendar.oneYearBack")}
          >
            <Icon icon="ph:caret-double-left" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label={t("propertyCalendar.oneMonthBack")}
          >
            <Icon icon="ph:caret-left" className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const now = new Date();
              setAnchor({ year: now.getFullYear(), month: now.getMonth() });
            }}
          >
            {t("propertyCalendar.today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label={t("propertyCalendar.oneMonthForward")}
          >
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(12)}
            aria-label={t("propertyCalendar.oneYearForward")}
          >
            <Icon icon="ph:caret-double-right" className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("propertyCalendar.loading")}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {months.map((m) => (
            <MonthGrid
              key={`${m.year}-${m.month}`}
              year={m.year}
              month={m.month}
              byDay={byDay}
              todayKey={todayKey}
              onOpen={(id) => router.push(`/reservierungen/${id}`)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  year,
  month,
  byDay,
  todayKey,
  onOpen,
  t,
}: {
  year: number;
  month: number;
  byDay: Record<string, Reservation>;
  todayKey: string;
  onOpen: (reservationId: string) => void;
  t: ReturnType<typeof useTranslations<"reservations">>;
}) {
  const start = gridStart(year, month);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="text-center font-display text-base font-bold">
        {t(MONTH_NAME_KEYS[month])} {year}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key} className="py-1 font-semibold">
            {t(key)}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === month;
          const k = dateKey(d);
          const res = byDay[k];
          const isToday = k === todayKey;
          return (
            <button
              key={k}
              type="button"
              disabled={!res}
              onClick={() => res && onOpen(res.id)}
              aria-label={res ? t("propertyCalendar.occupiedOpenBooking") : undefined}
              className={
                "flex aspect-square items-center justify-center rounded-md text-sm " +
                (!inMonth
                  ? "text-muted-foreground/40 "
                  : res
                    ? "cursor-pointer bg-accent/15 font-semibold text-accent hover:bg-accent/25 "
                    : "text-foreground ") +
                (isToday ? "ring-2 ring-accent ring-offset-1" : "")
              }
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
