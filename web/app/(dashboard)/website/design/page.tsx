// Design-Reiter: Theme, Farben, Schriften, Buttons.
//
// Realtime auf `tenant_site_config`, weil Design-Änderungen auch aus einer
// zweiten Sitzung kommen können, und auf `site_pages`, damit der
// Veröffentlichen-Knopf weiß, ob es noch etwas zu veröffentlichen gibt.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DesignAnsicht } from "@/components/website/design-ansicht";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function DesignSeite() {
  const { keinZugriff, branding, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <DesignAnsicht branding={branding} pages={pages} domains={domains} />
    </div>
  );
}
