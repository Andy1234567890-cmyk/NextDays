// Eigentümer-Übersicht (Agentur verwaltet Objekte für fremde Eigentümer).
// Server Component — lädt die Liste, rendert sie als Client-Komponente mit
// Anlage-Dialog.
import { OwnersList } from "@/components/eigentuemer/owners-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { listOwners } from "@/lib/owners";

export default async function EigentuemerPage() {
  const res = await listOwners();
  return (
    <>
      {/* Realtime-Pflicht: Liste live halten, sobald sich owners ändert. */}
      <RealtimeRefresh tables={["owners"]} />
      <OwnersList
        initial={res.ok ? res.data.items : []}
        loadError={res.ok ? null : res.error}
      />
    </>
  );
}
