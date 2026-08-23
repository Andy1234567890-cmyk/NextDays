// Seiten-Reiter: Seitenliste nach Navigationszone, Vorschau rechts.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeitenAnsicht } from "@/components/website/seiten-ansicht";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function SeitenSeite() {
  const { keinZugriff, pages, domains, branding } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <SeitenAnsicht pages={pages} domains={domains} branding={branding} />
    </div>
  );
}
