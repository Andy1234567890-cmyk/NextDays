"use client";

// Popover-Primitiv (shadcn-Stil) auf Basis von @radix-ui/react-popover.
// Anders als Tooltip: per Klick geöffnet, Inhalt darf interaktiv sein
// (Buttons, Links). Icons via Iconify (ph:*) — niemals lucide-react.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-80 rounded-(--radius) border border-border bg-background p-4 text-sm shadow-lg outline-none",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
