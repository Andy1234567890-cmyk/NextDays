// Texteingabe-Primitiv (shadcn-Stil, Tailwind-v4-Tokens).
// Unterstützt Fehler- und Disabled-Zustand. Radix nicht nötig.
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type InputProps = ComponentProps<"input"> & {
  // Fehler-Zustand: roter Rahmen + Fokus-Ring in destructive.
  error?: boolean;
};

export function Input({ className, type = "text", error = false, ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={error || undefined}
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
