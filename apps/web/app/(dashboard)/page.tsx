// Dashboard-Übersicht (Startseite).
// Solange das Onboarding des Tenants nicht abgeschlossen ist, zeigt das
// Dashboard den Setup-Assistenten (ersetzt den Inhalt). Danach erscheint das
// Reservierungs-Dashboard (echte Kennzahlen aus dem Backend).
import { Icon } from "@iconify/react";

import { ReservationsDashboard } from "@/components/dashboard/reservations-dashboard";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, CardContent } from "@/components/ui/card";
import { getOnboarding } from "@/lib/onboarding";
import { getDashboard } from "@/lib/reservations";
import { currentUserEmail } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [onboarding, loginEmail] = await Promise.all([
    getOnboarding(),
    currentUserEmail(),
  ]);

  // Onboarding noch offen → Assistent im Dashboard anzeigen.
  const status = onboarding.ok ? onboarding.data : null;
  if (status && !status.completed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <OnboardingWizard initialStatus={status} loginEmail={loginEmail} />
      </div>
    );
  }

  const dashboard = await getDashboard();
  if (!dashboard.ok) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Icon icon="ph:warning-circle" className="size-6" />
          </span>
          <div>
            <p className="font-medium">Dashboard konnte nicht geladen werden</p>
            <p className="text-sm text-muted-foreground">{dashboard.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <RealtimeRefresh tables={["reservations", "properties", "availability"]} />
      <ReservationsDashboard data={dashboard.data} />
    </>
  );
}
