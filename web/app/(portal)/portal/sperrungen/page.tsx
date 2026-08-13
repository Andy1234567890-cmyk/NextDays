// Eigentümer-Portal · Sperrungen (§4.2).
//
// Der Eigentümer BEANTRAGT eine Sperrung — er trägt sie nicht ein. Das ist die
// bewusste Abweichung vom Branchenmuster (Hostaway „Owner Stay", Escapia
// self-service blocking lassen den Eigentümer direkt sperren): hier entscheidet
// die Verwaltung, weil eine Sperre kanalübergreifend Verkauf verhindert.
// Entsprechend gibt es in dieser Fläche keinen Aufruf gegen /calendar/block.
//
// Seit 0389 steht hier zusätzlich Stufe 1: Wünsche von Familienzugängen, die
// auf die Freigabe DIESES Eigentümers warten. Sie stehen bewusst ganz oben und
// auf derselben Seite — ein Sperrwunsch der Familie ist fachlich dasselbe
// Thema, und eine eigene Seite dafür würde übersehen. Wer keine
// Familienzugänge vergeben hat, sieht den Abschnitt gar nicht (die Komponente
// rendert bei leerer Liste `null`).
import { PortalFreigaben } from "@/components/portal/portal-freigaben";
import { PortalSperrungen } from "@/components/portal/portal-sperrungen";
import { getBlockRequests, getOwnerProperties } from "@/lib/portal";
import { listeOffeneFreigaben } from "@/lib/portal-familie";

export const dynamic = "force-dynamic";

export default async function PortalSperrungenPage() {
  const [objekte, antraege, freigaben] = await Promise.all([
    getOwnerProperties(),
    getBlockRequests(),
    listeOffeneFreigaben(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PortalFreigaben
        antraege={freigaben.ok ? freigaben.data.items : []}
        properties={objekte.ok ? objekte.data.items : []}
        // Ein Fehler NUR in der Freigabe-Liste darf die Sperrungs-Fläche
        // darunter nicht mit ausblenden — die beiden Abschnitte sind
        // unabhängig (Wurzel 5: „leer" ≠ „konnte nicht laden").
        error={freigaben.ok ? null : freigaben.error}
      />

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
    </div>
  );
}
