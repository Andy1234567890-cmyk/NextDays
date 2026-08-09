"use client";

// Info-Symbol („i") mit Erklärtext — EIN Baustein für alle Stellen, an denen
// ein Feld oder eine Kennzahl erklärt werden muss.
//
// Warum Popover und NICHT Tooltip: ein Tooltip öffnet auf Hover. Auf einem
// Touchgerät gibt es kein Hover — dort bliebe die Erklärung unerreichbar, und
// genau die Stellen, die sie brauchen (Geldregeln in der Abrechnung), wären auf
// dem Tablet stumm. Ein Popover öffnet auf KLICK und funktioniert deshalb mit
// Maus, Tastatur und Finger gleichermaßen. `LabelHint` (Tooltip) bleibt für
// kurze Feldhinweise in Formularen; hier geht es um Sätze, die man liest.
//
// Zugänglichkeit: der Auslöser ist ein echter `<button>` (fokussierbar, per
// Enter/Leertaste bedienbar), trägt ein sprechendes `aria-label` und Radix
// verbindet ihn über `aria-expanded`/`aria-controls` mit dem Inhalt. Der Text
// steht als echter Inhalt im Dokument, nicht in einem `title`-Attribut, das
// weder Screenreader zuverlässig vorlesen noch Finger öffnen können.
import { Icon } from "@iconify/react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

export function InfoHinweis({
  titel,
  text,
  ariaLabel,
  className,
}: {
  /** Überschrift im Popover — worum es geht (optional). */
  titel?: string;
  /** Die Erklärung. Mehrere Absätze als Array, sonst ein String. */
  text: string | string[];
  /**
   * Was der Knopf vorliest. MUSS sagen, WOZU die Erklärung gehört („Erklärung
   * zu Eigentümer-Auszahlung"), denn eine Seite mit zwölf gleich benannten
   * „Info"-Knöpfen ist per Screenreader nicht navigierbar.
   */
  ariaLabel: string;
  className?: string;
}) {
  const absaetze = Array.isArray(text) ? text : [text];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Icon icon="ph:info" className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-2">
        {titel && <p className="font-medium text-foreground">{titel}</p>}
        {absaetze.map((absatz) => (
          <p key={absatz} className="text-muted-foreground">
            {absatz}
          </p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
