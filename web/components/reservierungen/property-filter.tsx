"use client";

// Objekt-Filter fürs globale Kontrollzentrum (.. „Alle/Ausgewählte
// Unterkünfte" + „Alles zurücksetzen"). Popover mit Checkbox-Liste; leere
// Auswahl = alle Objekte (der Trigger zeigt dann „Alle Unterkünfte"). „Alles
// zurücksetzen" leert die Auswahl. Kein Fantasie-Zustand — die Liste kommt aus
// listProperties.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import type { Property } from "@/lib/properties";

export function PropertyFilter({
  properties,
  selected,
  onChange,
}: {
  properties: Property[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("reservations");
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0
      ? t("propertyFilter.allProperties")
      : selected.length === 1
        ? (properties.find((p) => p.id === selected[0])?.title ?? t("propertyFilter.oneProperty"))
        : t("propertyFilter.multipleProperties", { count: selected.length });

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="gap-2">
            <Icon icon="ph:house-line" className="size-4 text-muted-foreground" />
            <span className="text-sm">{label}</span>
            <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="end">
          <div className="max-h-72 overflow-y-auto p-1">
            {properties.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {t("propertyFilter.noProperties")}
              </p>
            ) : (
              properties.map((p) => (
                // label + htmlFor statt Wrapper-<button>: die Checkbox rendert
                // intern selbst einen <button role="checkbox"> — ein äußerer
                // <button> wäre ungültige Verschachtelung (Hydration-Fehler). Über
                // die id-Verknüpfung togglet ein Klick auf den ganzen Eintrag genau
                // einmal (kein Doppel-Toggle).
                <label
                  key={p.id}
                  htmlFor={`prop-filter-${p.id}`}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-(--radius) px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60"
                >
                  <Checkbox
                    id={`prop-filter-${p.id}`}
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <span className="truncate">{p.title}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
          className="gap-1 text-muted-foreground"
        >
          <Icon icon="ph:x" className="size-3.5" />
          {t("propertyFilter.resetAll")}
        </Button>
      )}
    </div>
  );
}
