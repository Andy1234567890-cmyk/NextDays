// Objekt → Statistiken (Lodgify „Kontrollzentrum"): KPI-Kacheln + Kanal-
// Verteilung, mit Zeitraum-Wähler. Daten aus dem property/{id}/stats-Endpunkt.
import { PropertyStatsView } from "@/components/reservierungen/property-stats";

export default async function StatistikenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyStatsView propertyId={id} />;
}
