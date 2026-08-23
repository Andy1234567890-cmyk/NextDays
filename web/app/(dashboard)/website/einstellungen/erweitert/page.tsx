// Einstellungen → Fortgeschritten: Favicon, eigener Code, Recht, Hauptschalter.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ErweitertLeiste } from "@/components/website/einstellungen/erweitert-leiste";

import { ladeBaukasten } from "../../daten";

export default async function ErweitertSeite() {
  const { branding, pages } = await ladeBaukasten();
  return (
    <>
      {/* Auch `site_pages`: die Seitenauswahl für Cookie-/Datenschutz-Verweis
          zeigt nur veröffentlichte Seiten, und ob eine Seite veröffentlicht ist,
          ändert sich im Seiten-Reiter. */}
      <RealtimeRefresh tables={["tenant_site_config", "site_pages"]} />
      <ErweitertLeiste branding={branding} pages={pages} />
    </>
  );
}
