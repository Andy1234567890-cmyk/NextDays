// Objekt-Zahlen tragen keinen Zeitraum und keine Veränderung — sie sind ein
// Bestand, kein Verlauf. Eine „Letzte 30 Tage"-Angabe daneben wäre schlicht
// falsch, deshalb eine eigene, schlankere Kachel statt `KpiKachel`.
//
// Bis zum Raster-Umbau lag sie unexportiert in reservations-dashboard.tsx. Sie
// steht jetzt in einer eigenen Datei, weil der Kachel-Katalog
// (`lib/dashboard-katalog.ts`) jede Kachel einzeln adressieren muss.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Card, CardContent } from "@nextdays/ui/card";

export function ObjektKachel({
  icon,
  title,
  value,
  label,
}: {
  icon: string;
  title: string;
  value: number;
  label: string;
}) {
  return (
    <Link
      href="/objekte"
      className="rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card className="h-full transition-colors hover:border-accent/40">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon icon={icon} className="size-5" />
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          <div>
            <p className="font-display text-4xl font-extrabold leading-none">
              {value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
