// Objekte-Übersicht (Server Component). Lädt die Objekte des Gastgebers server-
// zu-server; die Liste rendert den Airbnb-„Your listings"-Tabellen-Look inkl.
// Kopf/Aktionen selbst. Auth-Guard sitzt im Group-Layout.
import { ObjekteListe } from "@/components/objekte-liste";
import { getProperties } from "@/lib/properties";

export default async function ObjektePage() {
  const items = await getProperties();

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <ObjekteListe items={items} />
    </main>
  );
}
