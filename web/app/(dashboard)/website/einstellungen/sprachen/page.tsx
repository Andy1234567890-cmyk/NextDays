// Einstellungen → Sprachen der Kunden-Website.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SprachenLeiste } from "@/components/website/einstellungen/sprachen-leiste";

import { ladeBaukasten } from "../../daten";

export default async function SprachenSeite() {
  const { branding } = await ladeBaukasten();
  return (
    <>
      <RealtimeRefresh tables={["tenant_site_config"]} />
      <SprachenLeiste branding={branding} />
    </>
  );
}
