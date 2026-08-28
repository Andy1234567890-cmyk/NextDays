// Unterseite „Bilder" des Design-Reiters (0468) — eigene Adresse.
//
// Bisher NEU: `hero_image_url` stand seit 0426 im Branding-Typ, ohne dass ein
// Hero-Abschnitt ihn je gelesen hätte (`builder/components/blocks/hero.tsx`).
// Diese Seite macht das Feld wieder bedienbar — als Standard-Hero-Bild, das
// nur greift, solange ein Hero-Abschnitt kein eigenes Bild trägt.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";

export default async function BilderSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht
        branding={branding}
        pages={pages}
        domains={domains}
        unterseite="bilder"
      />
    </div>
  );
}
