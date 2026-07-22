// Objekt → Übersicht (Overview): Sektionskarten. Das Untermenü +
// der Kopf kommen aus dem Layout; hier nur der Overview-Inhalt.
import { PropertyOverview } from "@/components/objekte/property-overview";
import { getProperty } from "@/lib/properties";

export default async function ObjektOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  return <PropertyOverview initial={res.data} />;
}
