"use client";

// Datumsbereich-Wähler wie ..: Trigger zeigt den Bereich, Popover hat links
// Presets (Diese Woche, Letzte 30 Tage, Quartal, Jahr …) und rechts einen
// Zwei-Monats-Kalender mit Bereichsauswahl. Daneben ← →-Buttons, die die aktuelle
// Bereichslänge eine Periode zurück/vor schieben (wie in den Screenshots).
// Werte sind ISO-Strings (YYYY-MM-DD) — kompatibel zu den Backend-Parametern.
import { Icon } from "@iconify/react";
import { addDays, differenceInCalendarDays, format, parse } from "date-fns";
import { de } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@nextdays/ui/button";
import { Calendar } from "@nextdays/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import { cn } from "@/lib/utils";

export type IsoRange = { from: string; to: string };

function toDate(iso: string): Date {
  return parse(iso, "yyyy-MM-dd", new Date());
}
function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Presets: liefern einen ISO-Bereich relativ zu heute (kein Fantasie-Default —
// alle aus dem echten Kalender berechnet). Labels werden per Übersetzungs-Key
// aufgelöst (labelKey), damit diese Liste außerhalb der Komponente bleiben kann.
const PRESETS: { key: string; labelKey: string; range: () => IsoRange }[] = [
  {
    key: "this_week",
    labelKey: "presetThisWeek",
    range: () => {
      const now = new Date();
      const day = (now.getDay() + 6) % 7; // Montag = 0
      const start = addDays(now, -day);
      return { from: toIso(start), to: toIso(addDays(start, 6)) };
    },
  },
  {
    key: "last_7",
    labelKey: "presetLast7Days",
    range: () => {
      const now = new Date();
      return { from: toIso(addDays(now, -6)), to: toIso(now) };
    },
  },
  {
    key: "last_30",
    labelKey: "presetLast30Days",
    range: () => {
      const now = new Date();
      return { from: toIso(addDays(now, -29)), to: toIso(now) };
    },
  },
  {
    key: "this_month",
    labelKey: "presetThisMonth",
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toIso(start), to: toIso(end) };
    },
  },
  {
    key: "this_quarter",
    labelKey: "presetThisQuarter",
    range: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { from: toIso(start), to: toIso(end) };
    },
  },
  {
    key: "this_year",
    labelKey: "presetThisYear",
    range: () => {
      const now = new Date();
      return {
        from: toIso(new Date(now.getFullYear(), 0, 1)),
        to: toIso(new Date(now.getFullYear(), 11, 31)),
      };
    },
  },
];

export function shiftRange(range: IsoRange, direction: -1 | 1): IsoRange {
  // Um die volle Bereichslänge nach vorn/hinten schieben (.. ← →).
  const span = differenceInCalendarDays(toDate(range.to), toDate(range.from)) + 1;
  const from = addDays(toDate(range.from), direction * span);
  const to = addDays(toDate(range.to), direction * span);
  return { from: toIso(from), to: toIso(to) };
}

function labelFor(range: IsoRange): string {
  return `${format(toDate(range.from), "d. MMM yyyy", { locale: de })} – ${format(
    toDate(range.to),
    "d. MMM yyyy",
    { locale: de },
  )}`;
}

export function DateRangePopover({
  value,
  onChange,
}: {
  value: IsoRange;
  onChange: (range: IsoRange) => void;
}) {
  const t = useTranslations("reservations");
  const [open, setOpen] = useState(false);
  const selected: DateRange = { from: toDate(value.from), to: toDate(value.to) };

  const applyPreset = (range: IsoRange) => {
    onChange(range);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("dateRangePopover.previousPeriod")}
        onClick={() => onChange(shiftRange(value, -1))}
      >
        <Icon icon="ph:arrow-left" className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("dateRangePopover.nextPeriod")}
        onClick={() => onChange(shiftRange(value, 1))}
      >
        <Icon icon="ph:arrow-right" className="size-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="gap-2">
            <Icon icon="ph:calendar-blank" className="size-4 text-muted-foreground" />
            <span className="text-sm">{labelFor(value)}</span>
            <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="flex min-w-40 flex-col gap-0.5 border-b p-2 sm:border-b-0 sm:border-r">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.range())}
                  className={cn(
                    "rounded-(--radius) px-3 py-1.5 text-left text-sm transition-colors",
                    "hover:bg-secondary/60",
                  )}
                >
                  {t(`dateRangePopover.${p.labelKey}`)}
                </button>
              ))}
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={selected.from}
              selected={selected}
              onSelect={(r) => {
                if (r?.from && r?.to) {
                  onChange({ from: toIso(r.from), to: toIso(r.to) });
                }
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
