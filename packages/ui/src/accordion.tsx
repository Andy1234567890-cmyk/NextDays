"use client";

// Akkordeon (shadcn-Stil, Radix-Primitive).
//
// Neben `collapsible.tsx` und nicht statt dessen: Collapsible ist EIN Bereich,
// der auf- und zugeht (Sidebar-Gruppen). Das Akkordeon führt MEHRERE Bereiche
// als Gruppe und kann erzwingen, dass immer nur einer offen ist
// (`type="single"`). Genau das braucht eine Schrittliste, in der der nächste
// offene Schritt sichtbar sein soll und die erledigten zusammengeklappt.
//
// Die Auf-/Zu-Animation kommt fertig aus `tw-animate-css` (in globals.css
// importiert): `animate-accordion-down`/`-up` samt Keyframes, die die
// Radix-Variable `--radix-accordion-content-height` auswerten. Keine eigenen
// Keyframes anlegen — eine erfundene Klasse fällt hier still aus, der Inhalt
// klappt dann hart um und es sieht nach einem Layout-Fehler aus.
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "./utils";

export function Accordion({
  ...props
}: ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  // Ein Schritt, der eine Vorbedingung hat, zeigt statt des Aufklapp-Pfeils
  // nichts an — der Pfeil verspricht sonst einen Inhalt, den ein gesperrter
  // Eintrag nicht ausklappt.
  ohnePfeil = false,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger> & {
  ohnePfeil?: boolean;
}) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-center gap-3 py-4 text-left text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none",
          "[&[data-state=open]>svg.akkordeon-pfeil]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        {!ohnePfeil && (
          <Icon
            icon="ph:caret-down"
            aria-hidden
            className="akkordeon-pfeil ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none"
          />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
