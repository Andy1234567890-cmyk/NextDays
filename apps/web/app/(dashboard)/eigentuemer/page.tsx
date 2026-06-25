// Eigentümer-Übersicht (Agentur verwaltet Objekte für fremde Eigentümer).
// Server Component — lädt die Liste, rendert sie als Client-Komponente mit
// Anlage-Dialog.
import { OwnersList } from "@/components/eigentuemer/owners-list";
import { listOwners } from "@/lib/owners";

export default async function EigentuemerPage() {
  const res = await listOwners();
  return (
    <OwnersList
      initial={res.ok ? res.data.items : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
