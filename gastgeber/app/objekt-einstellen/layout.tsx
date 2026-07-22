// Wizard-Layout (Objekt einstellen). BEWUSST außerhalb der (dashboard)-Group:
// kein Sidebar-Chrome — Vollbild, ein Fokus pro Schritt (Airbnb-„Become a Host"-
// Referenz, Memory onboarding-airbnb-wizard-referenz). Auth-Guard hier separat,
// da nicht im (dashboard)-Layout.
import { redirect } from "next/navigation";

import { getMe } from "@/lib/me";

export default async function WizardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getMe();
  if (!me?.tenant_id) redirect("/anmelden?weiter=/objekt-einstellen");
  return <div className="min-h-screen bg-background">{children}</div>;
}
