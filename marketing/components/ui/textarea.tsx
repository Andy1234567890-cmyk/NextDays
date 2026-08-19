// Mehrzeilige Eingabe (shadcn-Stil, Tailwind-v4-Tokens).
//
// Gleiche Bauart wie `input.tsx` — Fehler-Zustand über `aria-invalid` plus
// roter Rahmen, keine eigene Farb- oder Radius-Erfindung. Bewusst KEIN
// `resize-none`: wer einen langen Text schreibt, darf das Feld größer ziehen.
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type TextareaProps = ComponentProps<"textarea"> & {
  error?: boolean;
};

export function Textarea({ className, error = false, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={error || undefined}
      className={cn(
        "flex min-h-28 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  );
}

export type { TextareaProps };
