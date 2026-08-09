// Eigentümer-Portal · Dienstleistungen buchen (§4.2).
//
// Der beauftragbare Katalog kommt vom Server (/public-portal/service-types,
// Migration 0330): Endreinigung, Hauptreinigung, Fensterreinigung, Rasenmähen,
// Terrassenreinigung als Systemvorgaben plus eigene Typen des Betriebs. Dazu
// der Freitext-Weg für alles andere. Der Auftrag landet als Aufgabe beim
// Betrieb; wer sie ausführt, sieht der Eigentümer nicht (§4.3).
import { PortalDienstleistungen } from "@/components/portal/portal-dienstleistungen";
import {
  getOwnerProperties,
  getServiceRequests,
  getServiceTypes,
} from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalDienstleistungenPage() {
  const [objekte, typen, auftraege] = await Promise.all([
    getOwnerProperties(),
    getServiceTypes(),
    getServiceRequests(),
  ]);

  return (
    <PortalDienstleistungen
      properties={objekte.ok ? objekte.data.items : []}
      types={typen.ok ? typen.data.items : []}
      requests={auftraege.ok ? auftraege.data.items : []}
      error={objekte.ok ? null : objekte.error}
      // Ohne Katalog ist die Auswahl leer — das muss sichtbar sein, sonst sieht
      // die Seite aus, als gäbe es keine Leistungen (Wurzel 4/5).
      typesError={typen.ok ? null : typen.error}
    />
  );
}
