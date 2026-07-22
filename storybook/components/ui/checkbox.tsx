// UI-Primitiv Checkbox (shadcn-Stil, Radix-Primitive).
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer group h-5 w-5 shrink-0 rounded-(--radius) border border-border bg-background transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {/* Häkchen im Zustand "checked", Minus im Zustand "indeterminate" (per data-state gesteuert) */}
        <Icon
          icon="ph:check-bold"
          className="h-3.5 w-3.5 group-data-[state=indeterminate]:hidden"
        />
        <Icon
          icon="ph:minus-bold"
          className="hidden h-3.5 w-3.5 group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
