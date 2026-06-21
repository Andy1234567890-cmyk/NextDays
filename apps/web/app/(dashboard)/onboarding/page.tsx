// Onboarding-Setup-Assistent — führt ein frisch registriertes Hotel bis zum
// ersten verkaufsfähigen Objekt. Auth-geschützt (über das (dashboard)-Layout,
// das getMe() prüft). Lädt den Channel-Manager-Status für den Kanäle-Schritt.
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getMe } from "@/lib/auth";
import { getChannexHealth } from "@/lib/channex";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const health = await getChannexHealth();

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <OnboardingWizard
        channelManagerReady={health.ok ? health.data.channel_manager_ready : false}
      />
    </div>
  );
}
