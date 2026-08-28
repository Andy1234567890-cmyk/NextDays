// Unterseite „Farben" des Design-Reiters (0468) — eigene Adresse.
//
// Trägt Designfarben (0446, bis 30 benannte Werte), die Farbrollen (die
// festen Stellen, die sich damit verknüpfen lassen) und die fertigen
// Paletten. Vorher stand das mitten in der einen langen DESIGN-Rolle.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function FarbenSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="farben"
      />
    </div>
  );
}
