"use client";

// Fortschrittsbalken (shadcn-Stil, Radix-Primitive).
//
// Radix und nicht ein eigenes `div`, obwohl ein Balken trivial aussieht: das
// Primitive setzt `role="progressbar"` samt `aria-valuenow/min/max` und hält
// den unbestimmten Zustand (`value=null`) auseinander vom Wert 0. Von Hand
// gebaute Balken im Repo hatten das nicht — ein Screenreader las dort gar
// nichts vor.
//
// Der Balken zeigt Fortschritt, nicht Erfolg: deshalb `bg-primary` und nicht
// die Akzentfarbe. Die Akzentfarbe ist im Dashboard die Handlungsfarbe (Knöpfe,
// aktive Zustände); ein Balken, der wie ein Knopf aussieht, lädt zum Klicken
// ein.
import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";

import { cn } from "./utils";

export function Progress({
  className,
  value,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) {
  // `value ?? 0` NUR für die Breite — `value` selbst geht unverändert an Radix
  // weiter, damit der unbestimmte Zustand (null) als solcher gemeldet wird.
  const anteil = value ?? 0;
  return (
    <ProgressPrimitive.Root
      value={value}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - anteil}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
