"use client";

// Buchungs-Filter (..): zwei Multiselect-Popover — „Unterkünfte" (einzelne
// Objekte) und „Ressourcen" (Unterkunftsart/property_type, unsere echte Kategorie-
// Ebene, da wir keine getrennten Zimmertypen je Objekt führen) — plus „Alles
// zurücksetzen". Leere Auswahl = alles. Werte kommen aus den Daten (kein
// erfundener Ressourcen-Typ).
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TYPE_LABELS } from "@/lib/property-meta";
import type { PropertyType } from "@/lib/properties";

export type FilterProp = { id: string; title: string; property_type: PropertyType };

function MultiSelect({
  icon,
  allLabel,
  options,
  selected,
  onChange,
}: {
  icon: string;
  allLabel: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? "1")
        : `${selected.length} ausgewählt`;

  const toggle = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((x) => x !== value)
        : [...selected, value],
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Icon icon={icon} className="size-4 text-muted-foreground" />
          <span className="text-sm">{label}</span>
          <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="max-h-72 overflow-y-auto p-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Keine Einträge.
            </p>
          ) : (
            options.map((o) => (
              <label
                key={o.value}
                htmlFor={`bf-${icon}-${o.value}`}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-(--radius) px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60"
              >
                <Checkbox
                  id={`bf-${icon}-${o.value}`}
                  checked={selected.includes(o.value)}
                  onCheckedChange={() => toggle(o.value)}
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BookingsFilter({
  properties,
  selectedProps,
  onProps,
  selectedTypes,
  onTypes,
}: {
  properties: FilterProp[];
  selectedProps: string[];
  onProps: (ids: string[]) => void;
  selectedTypes: string[];
  onTypes: (types: string[]) => void;
}) {
  // Ressourcen-Optionen = die tatsächlich vorkommenden Unterkunftsarten (aus den
  // Objekten abgeleitet, keine feste Liste — nur was es real gibt).
  const typeOptions = useMemo(() => {
    const present = Array.from(new Set(properties.map((p) => p.property_type)));
    return present.map((t) => ({ value: t, label: TYPE_LABELS[t] ?? t }));
  }, [properties]);

  const hasFilter = selectedProps.length > 0 || selectedTypes.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect
        icon="ph:house-line"
        allLabel="Alle Unterkünfte"
        options={properties.map((p) => ({ value: p.id, label: p.title }))}
        selected={selectedProps}
        onChange={onProps}
      />
      <MultiSelect
        icon="ph:stack"
        allLabel="Alle Ressourcen"
        options={typeOptions}
        selected={selectedTypes}
        onChange={onTypes}
      />
      {hasFilter && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onProps([]);
            onTypes([]);
          }}
          className="gap-1 text-muted-foreground"
        >
          <Icon icon="ph:x" className="size-3.5" />
          Alles zurücksetzen
        </Button>
      )}
    </div>
  );
}
