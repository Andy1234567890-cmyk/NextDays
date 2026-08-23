// Einstellungen → Anzeige: wie Suchfeld und Preise auf der Website erscheinen.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AnzeigeLeiste } from "@/components/website/einstellungen/anzeige-leiste";

import { ladeBaukasten } from "../../daten";

export default async function AnzeigeSeite() {
  const { branding } = await ladeBaukasten();
  return (
    <>
      <RealtimeRefresh tables={["tenant_site_config"]} />
      <AnzeigeLeiste branding={branding} />
    </>
  );
}
