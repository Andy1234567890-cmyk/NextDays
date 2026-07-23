// 2FA-Wizard-Seite (Vollbild). Lädt das Konto server-zu-server, um die
// Telefonnummer vorzubefüllen. Der Wizard selbst ist eine Client-Insel.
import { redirect } from "next/navigation";

import { ZweiFaWizard } from "@/components/konto/zweifa-wizard";
import { getAccount } from "@/lib/konto";

export default async function ZweiFaktorPage() {
  const account = await getAccount();
  if (!account) redirect("/anmelden?weiter=/zwei-faktor");
  return <ZweiFaWizard initialPhone={account.phone} />;
}
