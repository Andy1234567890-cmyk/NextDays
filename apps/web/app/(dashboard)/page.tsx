// Dashboard-Übersicht (Startseite). Vorerst der leere Inhaltsbereich des
// Layout-Gerüsts — KPI-Kacheln und Charts (Umsatz, Kanalverteilung, Lastenheft
// §2.1) folgen im nächsten Schritt.
import { Icon } from "@iconify/react";

import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-extrabold">
          Willkommen zurück
        </h2>
        <p className="text-muted-foreground">
          Hier entsteht dein NextDays-Dashboard.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Icon icon="ph:squares-four" className="size-6" />
          </span>
          <div>
            <p className="font-medium">Layout-Gerüst steht</p>
            <p className="text-sm text-muted-foreground">
              Sidebar, Topbar und Theme-Umschaltung sind aktiv. Als Nächstes
              kommen die Kennzahl-Kacheln und Diagramme hierher.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
