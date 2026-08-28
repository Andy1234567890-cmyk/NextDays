// Objekte-Reiter: welche Objekte auf der Kunden-Website erscheinen.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ObjekteAnsicht } from "@/components/website/objekte-ansicht";
import { listProperties } from "@/lib/properties";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function ObjekteSeite() {
  const [{ keinZugriff, pages, domains }, propsRes] = await Promise.all([
    ladeBaukasten(),
    listProperties(),
  ]);
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* `properties`, weil die Website-Sichtbarkeit auch in der Kanal-Karte des
          einzelnen Objekts umgeschaltet werden kann — die beiden Ansichten
          dürfen nicht auseinanderlaufen. */}
      <RealtimeRefresh tables={["properties", "site_pages"]} />
      <ObjekteAnsicht
        pages={pages}
        domains={domains}
        properties={propsRes.ok ? propsRes.data.items : []}
      />
    </div>
  );
}
