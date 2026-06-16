// Accordion-Primitiv (shadcn-Stil) auf Basis von Radix Accordion.
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Wurzel-Element (single, collapsible werden in den Stories gesetzt).
export function Accordion({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root className={cn(className)} {...props} />;
}

// Einzelner Abschnitt mit Trennlinie.
export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b border-border", className)}
      {...props}
    />
  );
}

// Klickbare Kopfzeile mit rotierendem Chevron.
export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "flex flex-1 items-center justify-between py-4 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <Icon
          icon="ph:caret-down"
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
          aria-hidden
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

// Aufklappbarer Inhalt mit Radix-Animations-Hooks.
export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        "overflow-hidden text-sm text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        className,
      )}
      {...props}
    >
      <div className="pb-4 pt-0">{children}</div>
    </AccordionPrimitive.Content>
  );
}
