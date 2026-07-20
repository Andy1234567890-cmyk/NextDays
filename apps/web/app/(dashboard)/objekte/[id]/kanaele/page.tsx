// Objekt → Kanäle (Lodgify-Muster: Kanäle gibt es global UND pro Objekt).
// Drei Gruppen (Website · Plattform · Portale), je Zeile ein Kanal mit
// Sichtbarkeit + (Portale) Mapping/Sync-Status. Serverseitig Objekt + gespeicherte
// OTA-Verbindungen laden; die Client-Komponente steuert Toggles/Connect.
import { PropertyChannels } from "@/components/objekte/property-channels";
import { getMe } from "@/lib/auth";
import { listChannelConnections } from "@/lib/channex";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // accommodation_type entscheidet, ob das Objekt sein eigenes Portal verbindet
  // (FeWo: eigene Booking-ID) oder ob das Portal auf Betriebs-Ebene verbunden und
  // hier nur das Booking-Zimmer zugeordnet wird (Hotel: eine Hotel-ID, Zimmer =
  // Room-Types darunter).
  const [propRes, connRes, me] = await Promise.all([
    getProperty(id),
    listChannelConnections(id),
    getMe(),
  ]);
  if (!propRes.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {propRes.error}
      </div>
    );
  }
  return (
    <PropertyChannels
      property={propRes.data}
      connections={connRes.ok ? connRes.data.items : []}
      accommodationType={me?.accommodation_type ?? null}
    />
  );
}
