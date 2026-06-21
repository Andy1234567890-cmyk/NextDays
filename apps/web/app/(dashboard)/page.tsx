// Dashboard-Übersicht (Startseite).
// Solange das Onboarding des Tenants nicht abgeschlossen ist, zeigt das
// Dashboard den Setup-Assistenten (ersetzt den Inhalt). Danach erscheint die
// normale Übersicht (KPI-Kacheln/Charts folgen).
import { Icon } from "@iconify/react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { getChannexHealth } from "@/lib/channex";
import { getOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [onboarding, health] = await Promise.all([
    getOnboarding(),
    getChannexHealth(),
  ]);

  // Onboarding noch offen → Assistent im Dashboard anzeigen.
  const status = onboarding.ok ? onboarding.data : null;
  if (status && !status.completed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <OnboardingWizard
          channelManagerReady={
            health.ok ? health.data.channex_configured : false
          }
          initialStatus={status}
        />
      </div>
    );
  }

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
