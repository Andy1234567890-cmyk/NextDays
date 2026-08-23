// Externe Widgets: Einbettungs-Code für fremde Seiten.
import { WidgetsAnsicht } from "@/components/website/widgets-ansicht";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function WidgetsSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  // KEIN Realtime-Abo: diese Seite erzeugt nur einen Text aus Werten, die der
  // Bediener hier selbst wählt. Ein Abo würde den Schnipsel unter seinen Händen
  // neu bauen, während er ihn markiert hat.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <WidgetsAnsicht pages={pages} domains={domains} branding={branding} />
    </div>
  );
}
