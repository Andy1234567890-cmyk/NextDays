"use client";

// Popover-Primitiv (shadcn-Stil) auf Basis von @radix-ui/react-popover.
// Anders als Tooltip: per Klick geöffnet, Inhalt darf interaktiv sein
// (Buttons, Links). Icons via Iconify (ph:*) — niemals lucide-react.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

import { cn } from "./utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

function PopoverContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        // Bevorzugte Seite explizit: ohne `side` nimmt Radix zwar ebenfalls
        // "bottom", aber der Wert steht dann nirgends und ein Aufrufer, der
        // ihn ändern will, muss raten. Die Kollisionserkennung bleibt AN
        // (Radix-Vorgabe) — ein Popover, das am Seitenende nicht mehr nach
        // unten passt, soll weiterhin nach oben klappen statt aus dem
        // Sichtfeld zu ragen. Was das Umklappen früher zum Flackern machte,
        // war die wechselnde Inhaltshöhe des Kalenders; die ist in
        // `calendar.tsx` per `fixedWeeks` festgenagelt.
        side={side}
        align={align}
        sideOffset={sideOffset}
        // Abstand zum Fensterrand, damit der Inhalt nicht bündig an der Kante
        // klebt und ein Popover nicht schon bei einem Pixel Überhang umklappt.
        collisionPadding={collisionPadding}
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
