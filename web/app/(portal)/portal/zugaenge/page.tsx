// Eigentümer-Portal · Familienzugänge (0389).
//
// Ein Ferienhaus gehört einer Familie, nicht einer Person. Hier gibt der
// Eigentümer Angehörigen und Freunden einen EIGENEN Login — statt sein Passwort
// zu teilen, was jeden Vorgang urheberlos machte (wer hat die Sperrung
// beantragt?).
//
// Eigene Seite und nicht Teil von /portal/sperrungen: Das ist Verwaltung von
// Personen, kein Kalendervorgang. Die Sperrwünsche, die aus diesen Zugängen
// entstehen, entscheidet der Eigentümer drüben bei den Sperrungen — dort, wo
// er ohnehin über Zeiträume nachdenkt.
import { PortalFamilie } from "@/components/portal/portal-familie";
import { getOwnerProperties } from "@/lib/portal";
import { listeFamilienzugaenge } from "@/lib/portal-familie";

export const dynamic = "force-dynamic";

export default async function PortalZugaengePage() {
  const [objekte, zugaenge] = await Promise.all([
    getOwnerProperties(),
    listeFamilienzugaenge(),
  ]);

  return (
    <PortalFamilie
      properties={objekte.ok ? objekte.data.items : []}
      zugaenge={zugaenge.ok ? zugaenge.data.items : []}
      error={
        objekte.ok ? (zugaenge.ok ? null : zugaenge.error) : objekte.error
      }
    />
  );
}
