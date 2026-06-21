// Onboarding-Setup-Assistent — führt ein frisch registriertes Unternehmen durch
// das Anlegen der Firmendaten (Admin-Konto). Auth-geschützt (über das
// (dashboard)-Layout, das getMe() prüft). Unterkünfte legt der Kunde danach im
// Objekte-Bereich an — das ist bewusst getrennt vom Onboarding.
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getMe } from "@/lib/auth";
import { currentUserEmail } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const loginEmail = await currentUserEmail();

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <OnboardingWizard loginEmail={loginEmail} />
    </div>
  );
}
