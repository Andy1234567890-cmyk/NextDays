"use client";

// Objekt-Zahlen tragen keinen Zeitraum und keine Veränderung — sie sind ein
// Bestand, kein Verlauf. Eine „Letzte 30 Tage"-Angabe daneben wäre schlicht
// falsch, deshalb eine eigene, schlankere Kachel statt `KpiKachel`.
//
// Eigene Datei, weil der Kachel-Katalog (`lib/dashboard-katalog.ts`, gerendert
// über `kachel-inhalt.tsx`) jede Kachel einzeln adressieren muss.
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { KachelKopf } from "@/components/dashboard/kachel-kopf";

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
  const tGemein = useTranslations("common");
  // Der Link liegt als Fläche ÜBER der Karte, nicht um sie herum. Grund ist
  // der Info-Punkt: sein Auslöser ist ein echter `<button>`, und ein `<button>`
  // in einem `<a>` ist weder gültiges HTML noch bedienbar — der Klick auf das
  // „i" wäre am Popover vorbei zur Navigation durchgeschlagen. Die ganze Karte
  // bleibt anklickbar; der Info-Punkt liegt mit `z-10` darüber.
  return (
    <Card className="relative h-full transition-colors hover:border-accent/40">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <KachelKopf
          icon={icon}
          title={title}
          gross
          info={
            /* Was die Zahl zählt („Unvollständige Objekte"), steckt hinter dem
               „i" statt als Zeile unter der Zahl zu stehen. */
            <span className="relative z-10 shrink-0">
              <InfoHinweis
                titel={title}
                text={label}
                ariaLabel={tGemein("explain", { label: title })}
              />
            </span>
          }
        />
        <div>
          <p className="font-display text-4xl font-extrabold leading-none">
            {value}
          </p>
        </div>
        <Link
          href="/objekte"
          className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* Der Link trägt seinen Namen unsichtbar: eine leere Fläche ohne
              Text ist für Screenreader ein Ziel ohne Beschriftung. */}
          <span className="sr-only">{title}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
