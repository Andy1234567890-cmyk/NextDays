// Berichte-Übersicht des Eigentümer-Reportings.
import { BerichteListe } from "@/components/eigentuemer/reporting/berichte-liste";
import { listReports } from "@/lib/owner-reporting";

export default async function BerichtePage() {
  const res = await listReports();
  return (
    <BerichteListe
      items={res.ok ? res.data.items : []}
      // Ein Ladefehler wird durchgereicht und benannt. Ihn als leere Liste
      // auszugeben wäre die Aussage „es gibt keine Berichte" — eine andere
      // Tatsache (Wurzel 4).
      loadError={res.ok ? null : res.error}
    />
  );
}
