// Schlichter Platzhalter für Objekt-Unterseiten, die noch nicht ausgebaut sind.
import { Icon } from "@iconify/react";

import { Card } from "@nextdays/ui/card";

export function SectionPlaceholder({
  title,
  icon,
  hint,
}: {
  title: string;
  icon: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Icon icon={icon} className="size-7 text-muted-foreground" />
        </span>
        <p className="font-display text-lg font-extrabold">In Arbeit</p>
        <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
      </Card>
    </div>
  );
}
