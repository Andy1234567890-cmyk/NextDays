// Unterseite „Breite & Abstand" des Design-Reiters (0468) — eigene Adresse.
//
// Inhaltsbreite (0435/0447) und der Abschnittsabstand. Vorher ein Abschnitt
// mitten in der einen langen DESIGN-Rolle, jetzt eine Unterseite.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function BreiteAbstandSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="breite-abstand"
      />
    </div>
  );
}
