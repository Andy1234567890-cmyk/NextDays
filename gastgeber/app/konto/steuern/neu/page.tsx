// Vollbild-Wizard für neue Steuerangaben. Aufgerufen aus dem Start-Popup im
// Steuern-Tab (/konto?bereich=steuern) mit ?gruppe=us|national|global.
//
// Die Länderregeln kommen vom Server, nicht aus dem Client: welche Nummer ein
// Land erwartet und was eine fehlende kostet, ist geldwirksam (Wurzel 4).
import { redirect } from "next/navigation";

import { SteuerVollbildWizard } from "@/components/konto/steuer-vollbild-wizard";
import { getLaenderRegeln } from "@/lib/steuern";

const GRUPPEN = new Set(["us", "national", "global"]);

export default async function SteuerNeuSeite({
  searchParams,
}: {
  searchParams: Promise<{ gruppe?: string }>;
}) {
  const { gruppe } = await searchParams;
  // Ohne gültige Gruppe zurück in den Tab: der Wizard soll nicht über eine
  // geratene URL in einem undefinierten Zustand starten (Wurzel 5).
  if (!gruppe || !GRUPPEN.has(gruppe)) redirect("/konto?bereich=steuern");

  const laender = await getLaenderRegeln();
  if (laender === null) redirect("/konto?bereich=steuern");

  return <SteuerVollbildWizard laender={laender} gruppe={gruppe} />;
}
