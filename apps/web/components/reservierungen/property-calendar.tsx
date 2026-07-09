"use client";

// Objekt-Kalender (Lodgify „Kalender"): drei Monate nebeneinander, belegte
// Nächte dieses Objekts hervorgehoben. Ein Klick auf eine belegte Zelle öffnet
// die Buchungsdetailseite. Speist sich aus listReservations(propertyId); live
// über useRealtime auf reservations. Belegung = occupiesNight (Check-out-Tag frei).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, dateKey, occupiesNight } from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Zwölf Monate ab dem Anker sichtbar (ein Jahr Belegung im Blick, wie Lodgify).
// Über die Kopf-Navigation verschiebt man das Fenster monats- oder jahresweise.
const VISIBLE_MONTHS = 12;

// Erster Montag ≤ Monatsanfang (Mo-basiertes Raster).
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mo=0 … So=6
  return addDays(first, -dow);
}

export function PropertyCalendar({ propertyId }: { propertyId: string }) {
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
        <h1 className="font-display text-2xl font-extrabold">Kalender</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-12)} aria-label="Ein Jahr zurück">
            <Icon icon="ph:caret-double-left" className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Einen Monat zurück">
            <Icon icon="ph:caret-left" className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const now = new Date();
              setAnchor({ year: now.getFullYear(), month: now.getMonth() });
            }}
          >
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Einen Monat weiter">
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(12)} aria-label="Ein Jahr weiter">
            <Icon icon="ph:caret-double-right" className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Lädt…</Card>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function MonthGrid({
  year,
  month,
  byDay,
  todayKey,
  onOpen,
}: {
  year: number;
  month: number;
  byDay: Record<string, Reservation>;
  todayKey: string;
  onOpen: (reservationId: string) => void;
}) {
  const start = gridStart(year, month);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="text-center font-display text-base font-bold">
        {MONTH_NAMES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 font-semibold">
            {w}
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
              aria-label={res ? `Belegt — Buchung öffnen` : undefined}
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
