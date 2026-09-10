"use client";

// Kalender-Primitiv auf Basis von react-day-picker v9, im myNextDays-Branding:
// abgerundete Ecken (--radius), Auswahl in Logo-Rot (--accent), Heute betont.
// Icons via Iconify (ph:*), niemals lucide-react. Nutzt ausschließlich
// semantische Tokens (keine arbitrary Hex), Maße in rem.
import { Icon } from "@iconify/react";
import { DayPicker } from "react-day-picker";
import { de } from "react-day-picker/locale";

import { cn } from "./utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={de}
      showOutsideDays={showOutsideDays}
      // Immer 6 Wochenzeilen (42 Tage), auch wenn der Monat mit 4 oder 5
      // auskäme. OHNE das ändert jeder Monatswechsel die Höhe des Kalenders:
      // gemessen für 2026 schwankt das Gitter zwischen 4 Zeilen (Februar 2027)
      // und 6 (März, August, November 2026) — bei `day: size-9` sind das bis
      // zu 4,5rem Unterschied. Steht der Kalender in einem Popover, rechnet
      // Radix bei jeder Höhenänderung die Position neu und klappt dabei je
      // nach Platz zwischen `side=top` und `side=bottom` um; das ist das
      // sichtbare Hoch-und-Runter-Springen der Datumsauswahl in der
      // Objektkartei. Die Zeilenzahl konstant zu halten nimmt dem Umklappen
      // die Ursache, statt die Kollisionserkennung abzuschalten (die den
      // Kalender am Seitenende aus dem Sichtfeld schieben würde).
      fixedWeeks={fixedWeeks}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "relative flex flex-col gap-4",
        month_caption: "flex items-center justify-center h-9 px-2",
        caption_label: "text-sm font-semibold capitalize",
        nav: "flex items-center justify-between absolute inset-x-3 top-3 z-10",
        button_previous:
          "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        button_next:
          "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.7rem] font-medium uppercase text-muted-foreground",
        week: "flex w-full mt-1",
        day: "size-9 p-0 text-center text-sm",
        day_button:
          "inline-flex size-9 cursor-pointer items-center justify-center rounded-full font-normal transition-colors hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40 line-through",
        hidden: "invisible",
        ...classNames,
      }}
      modifiersClassNames={{
        // Auswahl als runder roter Button (--accent) — Stil auf das Button-Kind,
        // damit kein eckiger Zellen-Hintergrund entsteht.
        selected:
          "[&>button]:bg-accent [&>button]:text-accent-foreground [&>button:hover]:bg-accent",
        today: "[&>button]:font-semibold [&>button]:text-accent",
      }}
      components={{
        Chevron: ({ orientation }) => (
          <Icon
            icon={
              orientation === "left"
                ? "ph:caret-left"
                : orientation === "right"
                  ? "ph:caret-right"
                  : orientation === "up"
                    ? "ph:caret-up"
                    : "ph:caret-down"
            }
            className="size-4"
          />
        ),
      }}
      {...props}
    />
  );
}
