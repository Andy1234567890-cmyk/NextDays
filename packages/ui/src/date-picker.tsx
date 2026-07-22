"use client";

// Gebrandeter Datepicker: Trigger im Input-Look, Popover mit unserem Calendar
// (abgerundet, Logo-Rot). Ersetzt den nativen <input type="date">, dessen
// Popup-Chrome sich nicht im Branding stylen lässt. Wert ist ein ISO-String
// (YYYY-MM-DD) — kompatibel zu den bestehenden period_from/period_to-Feldern.
import { Icon } from "@iconify/react";
import { format, parse } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";

import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

type DatePickerProps = {
  // Wert als ISO-Datum (YYYY-MM-DD) oder leer.
  value: string;
  onChange: (value: string) => void;
  // Nach Auswahl (Popover schließt) — Ersatz für das alte onBlur.
  onCommit?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DatePicker({
  value,
  onChange,
  onCommit,
  disabled = false,
  placeholder = "Datum wählen",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-(--radius) border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors",
            "hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span>
            {selected ? format(selected, "dd.MM.yyyy", { locale: de }) : placeholder}
          </span>
          <Icon icon="ph:calendar-blank" className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            const iso = d ? format(d, "yyyy-MM-dd") : "";
            onChange(iso);
            onCommit?.(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
