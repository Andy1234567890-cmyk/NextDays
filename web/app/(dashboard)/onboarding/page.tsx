// Onboarding-Setup-Assistent — führt ein frisch registriertes Unternehmen durch
// das Anlegen der Firmendaten (Admin-Konto). Auth-geschützt (über das
// (dashboard)-Layout, das getMe() prüft). Unterkünfte legt der Kunde danach im
// Objekte-Bereich an — das ist bewusst getrennt vom Onboarding.
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getSession } from "@/lib/auth";
import { currentUserEmail } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // getSession statt getMe: nur eine ECHTE Abmeldung (401/403) darf umleiten,
  // ein technischer Fehler nicht (sonst meldet ein 503 den Nutzer ab).
  const { me, abgemeldet } = await getSession();
  if (abgemeldet) redirect("/login");
  if (!me) return null; // technischer Fehler — das Layout zeigt den Hinweis

  const loginEmail = await currentUserEmail();

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      {/* Betriebsart vorbelegen, falls der Betrieb sie schon gewählt hat
          (tenants.accommodation_type) — Onboarding und Konto teilen dieselbe
          Wahrheit, keine erneute Auswahl. */}
      <OnboardingWizard
        loginEmail={loginEmail}
        initialAccommodationType={me.accommodation_type ?? null}
      />
    </div>
  );
}
