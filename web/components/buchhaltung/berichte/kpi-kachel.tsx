// Kennzahl-Kachel der Berichte: Kopf wie die Dashboard-Kacheln (KachelKopf),
// darunter EIN Wert und eine Unterzeile. Hilfetext AUSSCHLIESSLICH im ℹ-Icon.
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";

export function BerichtKpi({
  icon,
  title,
  wert,
  unterzeile,
  hinweis,
  ton = "neutral",
  ariaInfo,
}: {
  icon: string;
  title: string;
  wert: string;
  unterzeile?: ReactNode;
  hinweis?: string;
  ton?: "neutral" | "gut" | "schlecht";
  ariaInfo: string;
}) {
  const farbe =
    ton === "gut" ? "text-emerald-600" : ton === "schlecht" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Icon icon={icon} className="size-4 shrink-0" aria-hidden />
            <h3 className="truncate text-sm font-semibold text-foreground" title={title}>
              {title}
            </h3>
            {hinweis ? <InfoHinweis text={hinweis} ariaLabel={ariaInfo} /> : null}
          </div>
        </div>
        <p className={`font-display text-2xl font-extrabold tabular-nums ${farbe}`}>{wert}</p>
        {unterzeile ? <p className="text-xs text-muted-foreground">{unterzeile}</p> : null}
      </CardContent>
    </Card>
  );
}
