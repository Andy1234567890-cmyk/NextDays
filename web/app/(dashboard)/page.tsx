// Dashboard-Übersicht (Startseite).
// Solange das Onboarding des Tenants nicht abgeschlossen ist, zeigt das
// Dashboard den Setup-Assistenten (ersetzt den Inhalt). Danach erscheint das
// Reservierungs-Dashboard (echte Kennzahlen aus dem Backend).
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ReservationsDashboard } from "@/components/dashboard/reservations-dashboard";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { PaymentsStatusBanner } from "@/components/zahlungen/payments-status-banner";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, CardContent } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { getNachrichtenKennzahlen } from "@/lib/inbox";
import { getOnboarding } from "@/lib/onboarding";
import { getDashboard } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("nav");
  const [onboarding, me] = await Promise.all([
    getOnboarding(),
    getMe(),
  ]);
  const loginEmail = me?.email ?? null;

  // Rollen-Startseite (§4.2/§4.3): Das Reservierungs-Dashboard verlangt
  // VIEW_CALENDAR. Rollen ohne diese Fähigkeit (staff/cleaner) bekämen hier nur
  // eine 403-Fehlerkarte — deshalb auf ihre operative Startseite leiten, statt
  // sie auf einer toten Seite landen zu lassen.
  if (me && !me.capabilities.includes("view_calendar")) {
    redirect("/reservierungen/aufgaben");
  }

  // Onboarding noch offen → Assistent im Dashboard anzeigen.
  const status = onboarding.ok ? onboarding.data : null;
  if (status && !status.completed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <OnboardingWizard initialStatus={status} loginEmail={loginEmail} />
      </div>
    );
  }

  // Beide Quellen der Startseite parallel. Die Nachrichten-Kennzahlen sind
  // NICHT kritisch: wer keinen Zugang zum Posteingang hat, bekommt dort eine
  // Absage — dann entfällt der Abschnitt, statt die ganze Seite zu kippen.
  const [dashboard, kennzahlen] = await Promise.all([
    getDashboard(),
    getNachrichtenKennzahlen(),
  ]);
  if (!dashboard.ok) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Icon icon="ph:warning-circle" className="size-6" />
          </span>
          <div>
            <p className="font-medium">{t("dashboardLoadFailed")}</p>
            <p className="text-sm text-muted-foreground">{dashboard.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* `properties` speist die Objekt-Zahlen, `reservations` alle
          Reservierungskarten und KPIs.
          BEWUSST OHNE `portal_messages`/`channex_booking`: beide haben für
          `authenticated` weder `select`-Grant noch Publikationsmitgliedschaft
          (live geprüft), ein Abo darauf wäre eine stumme Attrappe. Der Grant
          ist hier auch nicht nachzuholen — es sind Gastkonversationen, und ein
          tenant-weites Leserecht gäbe sie jeder Rolle frei (Wurzel 6). Der
          Nachrichten-Abschnitt aktualisiert daher beim Seitenaufruf. */}
      <RealtimeRefresh tables={["reservations", "properties", "availability"]} />
      {/* Zahlungs-Status ist Sache der Konto-Führung (MANAGE_BILLING, wie der
          Backend-Endpunkt). Angestellte ohne diese Fähigkeit dürfen den Banner
          gar nicht sehen — sonst käme für sie nur ein 403-Fehler (Wurzel 3). */}
      {me?.capabilities.includes("manage_billing") && (
        <Suspense fallback={null}>
          <PaymentsStatusBanner />
        </Suspense>
      )}
      <ReservationsDashboard
        data={dashboard.data}
        nachrichten={kennzahlen.ok ? kennzahlen.data : null}
      />
    </>
  );
}
