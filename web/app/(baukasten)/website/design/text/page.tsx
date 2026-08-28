// Unterseite „Text" des Design-Reiters (0468) — eigene Adresse.
//
// Schriftarten (Überschrift/Absatz), die acht Text-Rollen DFLT/PAR/H1–H6
// (0447) und die zwei globalen Größen-Faktoren. Vorher drei getrennte
// Abschnitte in der einen langen DESIGN-Rolle, jetzt eine Unterseite.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function TextSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="text"
      />
    </div>
  );
}
