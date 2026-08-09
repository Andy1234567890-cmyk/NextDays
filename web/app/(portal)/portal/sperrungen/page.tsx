// Eigentümer-Portal · Sperrungen (§4.2).
//
// Der Eigentümer BEANTRAGT eine Sperrung — er trägt sie nicht ein. Das ist die
// bewusste Abweichung vom Branchenmuster (Hostaway „Owner Stay", Escapia
// self-service blocking lassen den Eigentümer direkt sperren): hier entscheidet
// die Verwaltung, weil eine Sperre kanalübergreifend Verkauf verhindert.
// Entsprechend gibt es in dieser Fläche keinen Aufruf gegen /calendar/block.
import { PortalSperrungen } from "@/components/portal/portal-sperrungen";
import { getBlockRequests, getOwnerProperties } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalSperrungenPage() {
  const [objekte, antraege] = await Promise.all([
    getOwnerProperties(),
    getBlockRequests(),
  ]);

  return (
    <PortalSperrungen
      properties={objekte.ok ? objekte.data.items : []}
      requests={antraege.ok ? antraege.data.items : []}
      error={
        objekte.ok
          ? antraege.ok
            ? null
            : antraege.error
          : objekte.error
      }
    />
  );
}
