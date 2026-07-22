// Formular-Label (shadcn-Stil, Radix-Primitive, Tailwind-v4-Tokens).
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "inline-flex items-center gap-1.5 text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

type LabelProps = ComponentProps<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
}

// Pflichtfeld-Markierung (rot, semantischer Token).
export function LabelRequired({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("text-destructive", className)}
      {...props}
    >
      *
    </span>
  );
}

export { labelVariants };
