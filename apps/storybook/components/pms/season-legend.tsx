// Fachliche PMS-Komponente: Saison-Farb-Legende (Lastenheft §2.3).
// Listet Saison-Kategorien mit Farbkästchen, Label und Prozent-Aufschlag-Badge.
// Icons via Iconify — niemals lucide-react. Nur semantische Token-Klassen (keine Hex).
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Verfügbare Token-basierte Farbtöne für die Saison-Kästchen.
// Bewusst KEINE Hex-Werte: nur semantische bzw. Token-Klassen.
export type SeasonColor =
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "destructive"
  | "secondary";

// Zuordnung Farbton → Token-Hintergrundklasse für das Kästchen.
const SWATCH_CLASS: Record<SeasonColor, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  secondary: "bg-secondary",
};

// Eine Saison-Kategorie der Legende.
export type SeasonCategory = {
  /** Eindeutiger Schlüssel der Kategorie (z.B. "a", "b"). */
  key: string;
  /** Anzeige-Label (z.B. "Nebensaison"). */
  label: string;
  /** Token-Farbton für das Kästchen. */
  color: SeasonColor;
  /** Prozent-Aufschlag gegenüber Basispreis (z.B. 0, 15, 40). */
  surchargePercent: number;
};

type SeasonLegendProps = Omit<ComponentProps<"div">, "title"> & {
  /** Liste der Saison-Kategorien (Beispiel A–D). */
  categories: SeasonCategory[];
  /** Überschrift der Legende. */
  title?: string;
  /** Optionaler Beschreibungstext unter der Überschrift. */
  description?: string;
};

// Prozent-Aufschlag mit Vorzeichen formatieren (0 % = ohne Vorzeichen).
function formatSurcharge(percent: number): string {
  if (percent === 0) return "0 %";
  return `+${percent} %`;
}

// Badge-Variante je nach Höhe des Aufschlags (Token-basiert).
function surchargeVariant(
  percent: number,
): "secondary" | "warning" | "destructive" {
  if (percent === 0) return "secondary";
  if (percent >= 40) return "destructive";
  return "warning";
}

export function SeasonLegend({
  className,
  categories,
  title = "Saison-Legende",
  description = "Prozentualer Aufschlag je Saison gegenüber dem Basispreis.",
  ...props
}: SeasonLegendProps) {
  return (
    <Card className={cn("w-full max-w-md", className)} {...props}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon="ph:calendar-blank" className="size-5 text-muted-foreground" />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.key}
              className="flex items-center justify-between gap-3 rounded-(--radius) border border-border bg-background px-3 py-2"
            >
              <span className="flex items-center gap-3">
                {/* Farbkästchen (Token-Farbton, keine Hex). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 rounded-(--radius) border border-border",
                    SWATCH_CLASS[category.color],
                  )}
                />
                <span className="text-sm font-medium text-foreground">
                  {category.label}
                </span>
              </span>
              <Badge variant={surchargeVariant(category.surchargePercent)}>
                {formatSurcharge(category.surchargePercent)}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
