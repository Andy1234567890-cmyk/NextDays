// Natives Select-Primitiv (shadcn-Stil, Tailwind-v4-Tokens).
// Teilt exakt den Input-Stil (Höhe, Radius, Border, Padding), damit Selects und
// Inputs in Formularen einheitlich aussehen. Für lange Listen (Länder,
// Rechtsformen) praktischer als das Radix-Select.
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type NativeSelectProps = ComponentProps<"select"> & {
  // Fehler-Zustand: roter Rahmen + Fokus-Ring in destructive.
  error?: boolean;
};

export function NativeSelect({
  className,
  error = false,
  children,
  ...props
}: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={error || undefined}
        className={cn(
          "flex h-10 w-full appearance-none rounded-(--radius) border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <Icon
        icon="ph:caret-down"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-70"
      />
    </div>
  );
}

export type { NativeSelectProps };
