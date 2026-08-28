// SEO/AEO → Strukturierte Daten (JSON-LD), 0430.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeoSchemaLeiste } from "@/components/website/seo/schema-leiste";

import { ladeBaukasten } from "../../daten";

export default async function SeoSchemaSeite() {
  const { branding } = await ladeBaukasten();
  return (
    <>
      <RealtimeRefresh tables={["tenant_site_config"]} />
      <SeoSchemaLeiste branding={branding} />
    </>
  );
}
