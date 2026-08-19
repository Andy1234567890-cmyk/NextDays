// Auswahlfeld (shadcn-Stil, Tailwind-v4-Tokens).
//
// Bewusst das NATIVE `<select>` und kein Radix-Popover: die Themenwahl im
// Kontaktformular ist das erste Feld, das ein Besucher anfasst, und das native
// Element funktioniert ohne JavaScript, mit Tastatur, mit Screenreader und auf
// dem Handy mit dem systemeigenen Rad. Ein nachgebautes Menü wäre hier mehr
// Code für weniger Verlässlichkeit.
//
// Der Pfeil ist ein eingebettetes SVG als `background-image`, damit kein
// zusätzliches Element über dem Feld liegt (das würde Klicks abfangen).
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type SelectProps = ComponentProps<"select"> & {
  error?: boolean;
};

// Phosphor „caret-down", url-kodiert. Inline statt aus dem Icon-Satz: als
// CSS-Hintergrund braucht es eine Data-URL, keine React-Komponente.
const PFEIL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='%2371717a'%3E%3Cpath d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 53.66 90.34L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E\")";

export function Select({
  className,
  error = false,
  children,
  ...props
}: SelectProps) {
  return (
    <select
      aria-invalid={error || undefined}
      style={{
        backgroundImage: PFEIL,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.75rem center",
        backgroundSize: "1.1rem",
      }}
      className={cn(
        "flex h-10 w-full appearance-none rounded-(--radius) border border-border bg-background py-2 pl-3 pr-10 text-sm text-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export type { SelectProps };
