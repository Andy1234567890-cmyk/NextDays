// Logo-Unterseite des Design-Reiters — eine EIGENE Adresse.
//
// Vorher war das ein `useState` in der Design-Leiste: der Bereich hatte keine
// URL, ein Neuladen warf zurück in die Grundansicht, und der Zurück-Knopf des
// Browsers verließ den Baukasten statt eine Ebene hoch zu gehen. Lodgify löst es
// genauso mit `/styles/logo` (live abgelesen am 23.08.2026).
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function LogoSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="logo"
      />
    </div>
  );
}
