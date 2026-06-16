// UI-Primitiv "Progress" (shadcn-Stil, Tailwind-v4-Tokens, CVA-Varianten).
// Fortschrittsbalken (Wert 0-100) über semantische Token-Farben.
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const progressVariants = cva(
  // Spur: Hintergrund-Schiene, abgerundet, überlauf-sicher
  "relative w-full overflow-hidden rounded-full bg-secondary",
  {
    variants: {
      size: {
        default: "h-2",
        sm: "h-1",
        lg: "h-3",
      },
    },
    defaultVariants: { size: "default" },
  },
);

const indicatorVariants = cva(
  // Füllung: gleitet via transform, Farbe je nach Zustand
  "h-full w-full flex-1 rounded-full transition-transform duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "bg-primary",
        accent: "bg-accent",
        // Status-Farben gemäß BUILD_REFERENCE (über Tokens)
        success: "bg-primary", // erfolgreich/erledigt (grün via Theme-Token)
        warning: "bg-secondary", // ausstehend (gedämpft)
        destructive: "bg-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ProgressProps = Omit<ComponentProps<"div">, "children"> &
  VariantProps<typeof progressVariants> &
  VariantProps<typeof indicatorVariants> & {
    /** Fortschrittswert 0–100 */
    value?: number;
    /** Maximalwert (Standard 100) */
    max?: number;
  };

export function Progress({
  className,
  value = 0,
  max = 100,
  size,
  variant,
  ...props
}: ProgressProps) {
  // Wert sicher in den Bereich 0..max klemmen
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      className={cn(progressVariants({ size }), className)}
      {...props}
    >
      <div
        className={indicatorVariants({ variant })}
        // Füllung via translateX statt width für flüssige Animation
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </div>
  );
}

export { progressVariants, indicatorVariants };
