// Mehrzeilige Texteingabe (shadcn-Stil, Tailwind-v4-Tokens).
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./utils";

const textareaVariants = cva(
  "flex min-h-20 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      // Fehler-Zustand: destruktive Rahmen-/Fokus-Farbe.
      error: {
        true: "border-destructive focus-visible:ring-destructive",
        false: "",
      },
    },
    defaultVariants: { error: false },
  },
);

type TextareaProps = ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants>;

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={error || undefined}
      className={cn(textareaVariants({ error }), className)}
      {...props}
    />
  );
}

export { textareaVariants };
