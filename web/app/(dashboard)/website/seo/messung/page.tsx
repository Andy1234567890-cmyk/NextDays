// SEO/AEO → Messung: Google-Tag + Zustimmung (0430).
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeoMessungLeiste } from "@/components/website/seo/messung-leiste";

import { ladeBaukasten } from "../../daten";

export default async function SeoMessungSeite() {
  const { branding } = await ladeBaukasten();
  return (
    <>
      <RealtimeRefresh tables={["tenant_site_config"]} />
      <SeoMessungLeiste branding={branding} />
    </>
  );
}
