// Unterseite „Site-Layout" des Design-Reiters (0468) — eigene Adresse.
//
// Vorher war das der Theme-Wähler ganz oben in der einen langen DESIGN-Rolle.
// Jetzt eine eigene Unterseite wie bei Hostaway: Header · Sidebar (unser
// „seitlich") · Karte · Mittig, mit eigenem Panel-Kopf `‹ LAYOUT ⊡ ✕`.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function SiteLayoutSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="site-layout"
      />
    </div>
  );
}
