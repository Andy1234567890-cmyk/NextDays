// Objekt → Synchronisierung: welche Portal-Kennung trägt dieses Objekt, welche
// Einheit steht dort, und läuft der Abgleich? Serverseitig laden, damit die
// Seite ohne Zwischenzustand steht.
import { getTranslations } from "next-intl/server";

import { PropertySync } from "@/components/objekte/property-sync";
import { listChannelConnections } from "@/lib/channex";
import { getProperty, listUnits } from "@/lib/properties";

export default async function SynchronisierungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [propRes, connRes, unitRes, t] = await Promise.all([
    getProperty(id),
    listChannelConnections(id),
    listUnits(id),
    getTranslations("objects.sync"),
  ]);
  if (!propRes.ok) {
    return <p className="text-sm text-destructive">{t("loadFailed")}</p>;
  }
  return (
    <PropertySync
      property={propRes.data}
      connections={connRes.ok ? connRes.data.items : []}
      units={unitRes.ok ? unitRes.data : []}
    />
  );
}
