"use client";

// Ein <select> mit eigenem Pfeil.
//
// Der native Pfeil des Browsers sitzt direkt am Rand des Feldes und klebt damit
// am Text — auf der Sprachwahl der Rechtsseiten fiel genau das auf. Deshalb
// EINE Stelle für alle Auswahlfelder der Plattform: `appearance-none` schaltet
// den Systempfeil ab, `pr-9` hält den Platz frei, und das Chevron liegt als
// eigenes Icon darüber (`pointer-events-none`, damit Klicks weiterhin das Feld
// öffnen). Farbe über die Design-Token, nicht als Hintergrund-SVG mit
// hartkodierter Farbe.
import { Icon } from "@iconify/react";
import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Zusätzliche Klassen für das Feld (Radius, Breite, vertikales Padding). */
  className?: string;
  /** Klassen für den Rahmen um Feld + Pfeil — etwa `w-full`. */
  wrapperClassName?: string;
};

// text-base unter sm: ein <select> mit 14 px löst auf iOS Safari beim Öffnen
// denselben Zoom aus wie ein Textfeld, und die Seite bleibt danach verschoben.
const BASIS =
  "min-h-11 appearance-none border border-border bg-background pl-3 pr-9 text-base text-foreground outline-none focus:border-ring sm:min-h-0 sm:text-sm";

export function Select({
  className = "",
  wrapperClassName = "",
  children,
  ...props
}: Props) {
  return (
    <span className={`relative inline-flex items-center ${wrapperClassName}`}>
      <select {...props} className={`${BASIS} ${className}`}>
        {children}
      </select>
      <Icon
        icon="ph:caret-down"
        aria-hidden
        className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
      />
    </span>
  );
}
