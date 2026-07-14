// Eigentümer-Übersicht (Agentur verwaltet Objekte für fremde Eigentümer).
// Server Component — lädt die Liste, rendert sie als Client-Komponente mit
// Anlage-Dialog.
import { notFound } from "next/navigation";

import { OwnersList } from "@/components/eigentuemer/owners-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { listOwners } from "@/lib/owners";

export default async function EigentuemerPage() {
  const res = await listOwners();
  // Fehlende Berechtigung (manage_owners) → Seite existiert für diesen Nutzer
  // nicht (Sidebar-Gate + Rollen-Whitelist, Wurzel 3), kein 403-Fehlerkasten.
  if (!res.ok && res.status === 403) notFound();
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
