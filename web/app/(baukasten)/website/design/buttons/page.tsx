// Unterseite „Buttons" des Design-Reiters (0468) — eigene Adresse.
//
// Stil (gefüllt/umrandet), Eckenform und die Button-Schrift. Vorher der
// letzte Abschnitt der einen langen DESIGN-Rolle, jetzt eine Unterseite.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function ButtonsSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="buttons"
      />
    </div>
  );
}
