"use client";

// Segmentierter Pill-Umschalter (Kalender-Optik), generisch über string-
// oder number-Werte. Werkstatt-Kopie der apps/web-Vorlage, erweitert um
// optionale Icons (Iconify) und deaktivierbare Optionen.
import { Icon } from "@iconify/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const segmentedItemVariants = cva(
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        default: "px-3 py-1.5 text-sm",
        sm: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  /** Optionales Iconify-Icon, z.B. "ph:calendar-blank". */
  icon?: string;
  /** Option sichtbar lassen, aber nicht wählbar. */
  disabled?: boolean;
};

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size,
  className,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (v: T) => void;
  className?: string;
} & VariantProps<typeof segmentedItemVariants>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex rounded-full border border-border bg-secondary p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            segmentedItemVariants({ size }),
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon ? <Icon icon={o.icon} className="size-4 shrink-0" /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}
