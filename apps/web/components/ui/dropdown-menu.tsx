"use client";

// Dropdown-Menü-Primitiv (shadcn-Stil) auf Basis von @radix-ui/react-dropdown-menu.
// Icons via Iconify (ph:*) — niemals lucide-react. Nur semantische Token-Klassen.
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Wurzel + einfache Sub-Exports ohne eigenes Styling.
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

// Aufklapp-Inhalt im Portal.
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-32 overflow-hidden rounded-(--radius) border border-border bg-background p-1 text-foreground shadow-md",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

// Einzelner Menüeintrag; `inset` schafft Platz links (z.B. für ausgerichtete Beschriftungen).
function DropdownMenuItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm outline-none transition-colors",
        "focus:bg-secondary focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&>svg]:size-4 [&>svg]:shrink-0",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

// Eintrag mit Häkchen-Status (Iconify-Indikator).
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-(--radius) py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        "focus:bg-secondary focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Icon icon="ph:check" className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

// Eintrag mit Auswahl-Punkt (Iconify-Indikator).
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-(--radius) py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        "focus:bg-secondary focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Icon icon="ph:circle-fill" className="size-2" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

// Gruppen-Beschriftung; `inset` für Ausrichtung neben Häkchen-Einträgen.
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

// Trennlinie zwischen Gruppen.
function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

// Rechtsbündiger Hinweis (z.B. Tastenkürzel) innerhalb eines Eintrags.
function DropdownMenuShortcut({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

// Auslöser eines Untermenüs mit Iconify-Pfeil rechts.
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm outline-none transition-colors",
        "focus:bg-secondary focus:text-foreground data-[state=open]:bg-secondary",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <Icon icon="ph:caret-right" className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

// Inhalt eines Untermenüs im Portal.
function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          "z-50 min-w-32 overflow-hidden rounded-(--radius) border border-border bg-background p-1 text-foreground shadow-md",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};