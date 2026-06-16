// Fachliche PMS-Komponente: Inventar-Zeile (inventory-item).
// Lastenheft §2.5 (Inventar-Verwaltung).
// Tabelle: inventory_items (Bestand je Artikel; optionale Objekt-Zuordnung,
// sonst zentraler Pool). Beispiel: Wäschepakete.
// Stil-Standard exakt wie components/ui/button.tsx: named export,
// nur semantische Token-Klassen, Icons NUR via @iconify/react (ph:*).
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Optionale Objekt-Zuordnung. Ohne Zuordnung → zentraler Pool.
export type InventoryAssignment = {
  // Anzeigename des Objekts (z.B. "Ferienhaus Skagen").
  propertyName: string;
};

export type InventoryItemProps = Omit<
  ComponentProps<"div">,
  "onChange"
> & {
  // Artikelname, z.B. "Wäschepakete".
  name: string;
  // Aktuelle Menge im Bestand.
  quantity: number;
  // Optionale Maßeinheit (z.B. "Stk.", "Pakete"). Default: ohne Einheit.
  unit?: string;
  // Optionale Objekt-Zuordnung; ohne Wert → "Zentraler Pool".
  assignment?: InventoryAssignment;
  // Iconify-Symbol (ph:*) für den Artikel. Default: ph:package.
  icon?: string;
  // Untere/obere Grenze für die Mengen-Buttons.
  min?: number;
  max?: number;
  // Callback bei Mengen-Änderung über +/- (neue Menge).
  onQuantityChange?: (next: number) => void;
  // Schreibgeschützt: +/- Buttons deaktiviert.
  readOnly?: boolean;
};

export function InventoryItem({
  className,
  name,
  quantity,
  unit,
  assignment,
  icon = "ph:package",
  min = 0,
  max = Number.POSITIVE_INFINITY,
  onQuantityChange,
  readOnly = false,
  ...props
}: InventoryItemProps) {
  const canDecrement = !readOnly && quantity > min;
  const canIncrement = !readOnly && quantity < max;

  // Niedriger Bestand (am oder unter Minimum) → destruktive Hervorhebung.
  const isLow = quantity <= min;

  function handleStep(delta: number) {
    const next = Math.min(max, Math.max(min, quantity + delta));
    if (next !== quantity) onQuantityChange?.(next);
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-3 rounded-(--radius) border border-border bg-card px-4 py-3 text-card-foreground",
          className,
        )}
        {...props}
      >
        {/* Artikel-Symbol */}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius) bg-secondary text-foreground">
          <Icon icon={icon} className="size-5" />
        </span>

        {/* Name + Zuordnung */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium text-foreground">{name}</span>
          {assignment ? (
            <Badge variant="outline" className="w-fit">
              <Icon icon="ph:house" className="size-3.5" />
              {assignment.propertyName}
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit">
              <Icon icon="ph:stack" className="size-3.5" />
              Zentraler Pool
            </Badge>
          )}
        </div>

        {/* Mengen-Steuerung mit +/- Buttons */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Menge verringern"
                disabled={!canDecrement}
                onClick={() => handleStep(-1)}
              >
                <Icon icon="ph:minus" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Menge verringern</TooltipContent>
          </Tooltip>

          <span
            className={cn(
              "min-w-12 text-center text-sm font-semibold tabular-nums",
              isLow ? "text-destructive" : "text-foreground",
            )}
          >
            {quantity.toLocaleString("de-DE")}
            {unit ? <span className="ml-1 text-muted-foreground">{unit}</span> : null}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Menge erhöhen"
                disabled={!canIncrement}
                onClick={() => handleStep(1)}
              >
                <Icon icon="ph:plus" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Menge erhöhen</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
