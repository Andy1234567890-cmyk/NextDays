"use client";

// Gebrandeter Datum-UND-Uhrzeit-Wähler: derselbe Trigger-Look und derselbe
// Kalender wie `DatePicker`, im Popover ergänzt um ein Zeitfeld.
//
// WARUM ES IHN GIBT: `DatePicker` kann nur Tage. Für einen Zeitpunkt blieb
// deshalb nur `<input type="datetime-local">`, und dessen Popup-Chrome lässt
// sich nicht branden — es sieht in jedem Browser anders aus, auf Deutsch wie
// „03.09.2026, 02:00" mit abgeschnittenem Text in schmalen Feldern, und ein
// Kalenderblatt in Logo-Rot bekommt man dort gar nicht. Gebraucht wurde er für
// das Zeitfenster einer Aufgabe („28.8. von 10 bis 16 Uhr"); er steht hier im
// Design-System und nicht in dieser einen Fläche, weil jede weitere Stelle mit
// Terminen dieselbe Frage hat.
//
// Der Wert ist ein LOKALER Zeitstempel ohne Zone (`2026-08-28T10:00`) — genau
// die Form, die `<input type="datetime-local">` benutzt. Das hält den Tausch
// an bestehenden Stellen trivial und lässt die Umrechnung nach UTC dort, wo
// der Aufrufer sie ohnehin macht.
import { Icon } from "@iconify/react";
import { format, parse } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";

import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

type DateTimePickerProps = {
  /** Lokaler Zeitstempel `YYYY-MM-DDTHH:MM` oder leer. */
  value: string;
  onChange: (value: string) => void;
  /** Nach dem Schließen des Popovers (Ersatz für ein onBlur). */
  onCommit?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Schrittweite des Zeitfelds in Sekunden (300 = 5-Minuten-Schritte). */
  step?: number;
  className?: string;
  /** Beschriftung des Zeitfelds im Popover. */
  timeLabel?: string;
  /** Beschriftungen der beiden Knöpfe im Popover-Fuß.
   *
   *  Als Prop und nicht fest im Code: `packages/ui` hat keine Übersetzung —
   *  ein hier eingebautes „Leeren" stünde in allen 24 Sprachen auf Deutsch.
   *  Denselben Weg geht `DatePicker` mit seinem `placeholder`. Die Vorgaben
   *  sind Deutsch, weil ein Aufrufer, der sie vergisst, dann wenigstens ein
   *  Wort sieht statt einer leeren Fläche. */
  clearLabel?: string;
  doneLabel?: string;
};

/** Wert in seine zwei Teile zerlegen. Ein unvollständiger oder kaputter Wert
 *  ergibt leere Teile statt eines „Invalid Date" im Feld. */
function teile(value: string): { datum: string; uhr: string } {
  const [datum = "", uhr = ""] = value.split("T");
  return { datum, uhr: uhr.slice(0, 5) };
}

function toDate(datum: string): Date | undefined {
  if (!datum) return undefined;
  const d = parse(datum, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DateTimePicker({
  value,
  onChange,
  onCommit,
  disabled = false,
  placeholder = "Datum & Uhrzeit wählen",
  step = 300,
  className,
  timeLabel = "Uhrzeit",
  clearLabel = "Leeren",
  doneLabel = "Fertig",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const { datum, uhr } = teile(value);
  const selected = toDate(datum);

  /** Zusammensetzen. Ohne Datum gibt es keinen Zeitpunkt — eine Uhrzeit allein
   *  ist keiner, deshalb bleibt der Wert dann leer. Fehlt die Uhrzeit, gilt
   *  00:00: die Auswahl eines Tages soll nicht daran scheitern, dass niemand
   *  eine Zeit eingetragen hat. */
  const setzen = (neuesDatum: string, neueUhr: string, schliessen: boolean) => {
    const wert = neuesDatum ? `${neuesDatum}T${neueUhr || "00:00"}` : "";
    onChange(wert);
    if (schliessen) {
      onCommit?.(wert);
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Beim Schließen per Klick daneben ebenfalls bestätigen: sonst ginge
        // eine getippte Uhrzeit verloren, ohne dass es jemand merkt.
        if (!o) onCommit?.(value);
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-(--radius) border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors",
            "hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected
              ? `${format(selected, "dd.MM.yyyy", { locale: de })}${uhr ? `, ${uhr}` : ""}`
              : placeholder}
          </span>
          <Icon
            icon="ph:calendar-blank"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            // Der Tag schließt das Popover NICHT: die Uhrzeit steht darunter
            // und wäre sonst nur über ein zweites Öffnen erreichbar.
            setzen(d ? format(d, "yyyy-MM-dd") : "", uhr, false);
          }}
        />
        <div className="flex items-center gap-2 border-t px-3 py-2.5">
          <Icon
            icon="ph:clock"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="text-sm text-muted-foreground">{timeLabel}</span>
          <input
            type="time"
            step={step}
            value={uhr}
            // Ohne Datum ist eine Uhrzeit wirkungslos — das Feld sagt das,
            // statt eine Eingabe anzunehmen, die verworfen wird.
            disabled={!datum}
            onChange={(e) => setzen(datum, e.target.value, false)}
            className="ml-auto rounded-(--radius) border border-border bg-background px-2 py-1 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-3 py-2">
          <button
            type="button"
            onClick={() => setzen("", "", true)}
            className="rounded-(--radius) px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onCommit?.(value);
              setOpen(false);
            }}
            className="rounded-(--radius) bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {doneLabel}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
