// Kennzahl-Kachel fürs Dashboard: Titel, Wert, Trend (+/-) und Icon.
// Reine Darstellung — die Werte kommen später vom FastAPI-Backend.
import { Icon } from "@iconify/react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  title: string;
  value: string;
  icon: string;
  /** Veränderung ggü. Vorperiode, z. B. +12,5 % (positiv = grün, negativ = rot). */
  delta?: { value: string; positive: boolean };
  hint?: string;
};

export function KpiCard({ title, value, icon, delta, hint }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="flex size-8 items-center justify-center rounded-(--radius) bg-secondary text-muted-foreground">
            <Icon icon={icon} className="size-4" />
          </span>
        </div>

        <div className="font-display text-2xl font-extrabold tabular-nums">
          {value}
        </div>

        {(delta || hint) && (
          <div className="flex items-center gap-1.5 text-xs">
            {delta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  delta.positive ? "text-success" : "text-destructive",
                )}
              >
                <Icon
                  icon={delta.positive ? "ph:trend-up" : "ph:trend-down"}
                  className="size-3.5"
                />
                {delta.value}
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
