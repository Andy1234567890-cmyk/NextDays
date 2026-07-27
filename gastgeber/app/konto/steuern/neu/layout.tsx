// Vollbild-Layout für den Steuer-Wizard (Airbnb-Vorbild:
// /account-settings/taxes/taxpayers/global/create).
//
// Bewusst OHNE den Kontoeinstellungen-Kopf: Der Wizard ist ein eigener Flow,
// aus dem man nur über „Beenden" oder den Abschluss herauskommt. Eine
// sichtbare Seitennavigation daneben würde dazu einladen, mitten im Vorgang
// wegzuklicken und halbe Steuerangaben zu hinterlassen.
import { redirect } from "next/navigation";

import { getMe } from "@/lib/me";

export default async function SteuerWizardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getMe();
  if (!me?.tenant_id) redirect("/anmelden?weiter=/konto/steuern/neu");

  return <div className="min-h-screen bg-background">{children}</div>;
}
