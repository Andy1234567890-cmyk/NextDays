"use client";

// Durchsuchbares Multiselect (Combobox) auf Basis von cmdk + Popover. Für große
// Listen gedacht (z. B. Agentur mit 100+ Unterkünften): Suchfeld + scrollbare
// Trefferliste statt langer Checkbox-Spalte. Auswahl als Chips; leere Auswahl
// bedeutet im Aufrufer „alle". Icons via Iconify (ph:*), semantische Tokens.
import { Icon } from "@iconify/react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Auswählen …",
  searchPlaceholder = "Suchen …",
  emptyHint = "Keine Treffer.",
  allLabel = "Alle",
  className,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  // Anzeige, wenn nichts gewählt ist (= alle).
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const byValue = new Map(options.map((o) => [o.value, o.label]));

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-(--radius) border border-border bg-background px-3 py-1.5 text-left text-sm transition-colors",
            "hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                >
                  {byValue.get(v) ?? v}
                  <Icon
                    icon="ph:x"
                    className="size-3 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                  />
                </span>
              ))
            )}
          </span>
          <Icon icon="ph:caret-down" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command className="flex max-h-72 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selected.length === 0
                ? allLabel
                : `${selected.length} gewählt`}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => onChange([])}
              >
                {allLabel}
              </button>
            )}
          </div>
          <CommandInput
            placeholder={searchPlaceholder}
            className="border-b border-border px-3 py-2 text-sm outline-none"
          />
          <CommandList className="overflow-y-auto p-1">
            <CommandEmpty className="px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyHint}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                    className="flex cursor-pointer items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm data-[selected=true]:bg-secondary"
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded border border-border",
                        on && "border-accent bg-accent text-accent-foreground",
                      )}
                    >
                      {on && <Icon icon="ph:check" className="size-3" />}
                    </span>
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
