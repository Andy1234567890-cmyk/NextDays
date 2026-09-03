// Preise der beauftragbaren Dienstleistungen (0531).
//
// Sie liegen unter /aufgaben, weil eine bestellte Leistung als AUFGABE beim
// Betrieb landet und der Preis beim Abschluss dieser Aufgabe gilt. Der Katalog
// selbst gehoert dem Portal (dort bestellt der Eigentuemer), der Preis dem
// Betrieb — er entscheidet, was er berechnet.
import { DienstleistungPreise } from "@/components/reservierungen/dienstleistung-preise";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function DienstleistungPreisePage() {
  // Fuer die Objekt-Ausnahme. Schlaegt der Abruf fehl, bleiben die
  // Betriebsregeln bedienbar — die Liste ist dann nur leer, statt die Seite
  // zu kippen (Wurzel 5).
  const objekte = await listProperties();
  return (
    <DienstleistungPreise
      properties={
        objekte.ok
          ? objekte.data.items.map((p) => ({ id: p.id, title: p.title }))
          : []
      }
    />
  );
}
