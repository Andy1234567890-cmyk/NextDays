// SEO/AEO → Seiten: Titel und Beschreibung je Seite (0430).
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeoSeitenListe } from "@/components/website/seo/seiten-liste";

import { ladeBaukasten } from "../../daten";

export default async function SeoSeitenSeite() {
  const { branding, pages } = await ladeBaukasten();
  return (
    <>
      {/* Beide Quellen: die Liste zeigt die Seiten, und der Rückfall unter den
          leeren Feldern kommt aus der Site-Config. */}
      <RealtimeRefresh tables={["site_pages", "tenant_site_config"]} />
      <SeoSeitenListe pages={pages} branding={branding} />
    </>
  );
}
