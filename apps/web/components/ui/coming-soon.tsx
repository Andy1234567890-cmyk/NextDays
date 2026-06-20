// Platzhalter für Module, die noch portiert werden (My-Next-Integration).
// NextDays-Design: Card, font-display, Token-Klassen, rounded-full.
import { Icon } from "@iconify/react";

import { Card } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
  icon = "ph:wrench",
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {description ?? "Dieses Modul wird gerade aufgebaut."}
        </p>
      </div>
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Icon icon={icon} className="size-7 text-muted-foreground" />
        </span>
        <div>
          <p className="font-display text-lg font-extrabold">In Arbeit</p>
          <p className="text-sm text-muted-foreground">
            Wird in Kürze verfügbar sein.
          </p>
        </div>
      </Card>
    </div>
  );
}
