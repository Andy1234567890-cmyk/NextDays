// Eigentümer-Portal · Belegungskalender (§4.2, read-only).
//
// Der Eigentümer sieht Belegung, Saison-Färbung und seine NETTO-Auszahlung je
// Nacht. Er kann hier NICHTS sperren — es gibt bewusst keinen Weg auf
// /calendar/block; für eine Sperre stellt er einen Antrag (/portal/sperrungen).
//
// Das gewählte Objekt steht in der URL (?objekt=), damit ein Link aus der
// Übersicht direkt den richtigen Kalender öffnet.
import { PortalKalender } from "@/components/portal/portal-kalender";
import { getOwnerProperties } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ objekt?: string }>;
}) {
  const sp = await searchParams;
  const objekte = await getOwnerProperties();
  const items = objekte.ok ? objekte.data.items : [];

  // Vorauswahl NUR aus den eigenen Objekten — eine fremde ID aus der URL wird
  // verworfen, nicht durchgereicht (Wurzel 3: der Anfrage nicht vertrauen).
  // Der Backend-Scope prüft das ohnehin erneut; die UI soll nur nicht so tun,
  // als hätte sie Zugriff.
  const gewaehlt =
    sp.objekt && items.some((p) => p.id === sp.objekt)
      ? sp.objekt
      : (items[0]?.id ?? null);

  return (
    <PortalKalender
      properties={items}
      initialPropertyId={gewaehlt}
      error={objekte.ok ? null : objekte.error}
    />
  );
}
