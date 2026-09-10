"use client";

// Texteingabe-Primitiv (shadcn-Stil, Tailwind-v4-Tokens).
// Unterstützt Fehler- und Disabled-Zustand. Radix nicht nötig.
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import type { ComponentProps, WheelEvent } from "react";

import { cn } from "./utils";

type InputProps = ComponentProps<"input"> & {
  // Fehler-Zustand: roter Rahmen + Fokus-Ring in destructive.
  error?: boolean;
};

export function Input({
  className,
  type = "text",
  error = false,
  onWheel,
  ...props
}: InputProps) {
  // Scrollrad über einem FOKUSSIERTEN `type="number"` ändert im Browser den
  // Wert — der Nutzer scrollt durch ein langes Formular und die Zahl unter dem
  // Zeiger zählt still hoch oder runter. Das ist stiller Datenverlust: es
  // sieht wie Scrollen aus und schreibt in ein Feld. Deshalb bekommt das Feld
  // beim Rad den Fokus entzogen, statt das Ereignis abzubrechen: `preventDefault`
  // in einem React-`onWheel` greift hier nicht zuverlässig (React hängt den
  // Wheel-Listener passiv am Wurzelknoten), und die Seite soll weiterscrollen.
  // Nur `number` ist betroffen — Text-, Datums- und Suchfelder bleiben unberührt.
  const beiRad = (e: WheelEvent<HTMLInputElement>) => {
    onWheel?.(e);
    if (type === "number" && document.activeElement === e.currentTarget) {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      aria-invalid={error || undefined}
      onWheel={beiRad}
      className={cn(
        "flex h-10 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Fehler-Zustand überschreibt Rahmen + Fokus-Ring.
        error &&
          "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  );
}

export type { InputProps };
