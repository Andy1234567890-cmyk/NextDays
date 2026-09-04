// Konto → Benutzer → Detailseite eines Benutzers (/konto/nutzer/<id>).
//
// Serverseitig geladen, weil `users` für `authenticated` bewusst gesperrt ist
// (Wurzel 6, Migration 0337): ein Realtime-Abo darauf wäre eine stumme
// Attrappe. Nach jeder Änderung ruft die Client-Komponente `router.refresh()` —
// damit läuft diese Funktion erneut und zeigt den echten neuen Stand.
import { notFound } from "next/navigation";

import { BenutzerDetail } from "@/components/konto/benutzer-detail";
import {
  getAccount,
  getManagedUser,
  getOwnerProperties,
  getStaffProperties,
} from "@/lib/account";
import { getOwner, listOwners } from "@/lib/owners";
import { listProperties } from "@/lib/properties";

export default async function NutzerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const nutzerRes = await getManagedUser(userId);
  // 403 (staff/cleaner) und 404 (fremder Tenant) führen beide auf dieselbe
  // Seite: die Existenz eines fremden Nutzers ist keine Auskunft, die wir geben.
  if (!nutzerRes.ok) notFound();
  const user = nutzerRes.data;

  const rolleMitObjekten =
    user.role === "owner" ||
    user.role === "staff" ||
    user.role === "cleaner" ||
    user.role === "shift_lead";

  const [objekteRes, kontoRes, zuordnungRes] = await Promise.all([
    listProperties(),
    getAccount(),
    rolleMitObjekten
      ? user.role === "owner"
        ? getOwnerProperties(userId)
        : getStaffProperties(userId)
      : Promise.resolve(null),
  ]);

  const properties = objekteRes.ok ? objekteRes.data.items : [];
  const zugewiesen =
    zuordnungRes && zuordnungRes.ok ? zuordnungRes.data.property_ids : [];

  // Provisionssatz je Objekt kommt aus der Eigentümer-Kartei (EINE Quelle):
  // Override am Objekt, sonst der Standardsatz des Eigentümers. Fehlt beides,
  // bleibt der Eintrag `null` → die Oberfläche zeigt „—" und nicht 0 %.
  let ownerId: string | null = null;
  const provisionProObjekt: Record<string, number | null> = {};
  if (user.role === "owner") {
    const alle = await listOwners();
    const treffer = alle.ok
      ? alle.data.items.find((o) => o.user_id === userId)
      : undefined;
    if (treffer) {
      ownerId = treffer.id;
      const kartei = await getOwner(treffer.id);
      if (kartei.ok) {
        for (const link of kartei.data.properties) {
          provisionProObjekt[link.property_id] =
            link.commission_override_pct ?? kartei.data.default_commission_pct;
        }
      }
    }
  }

  return (
    <BenutzerDetail
      user={user}
      properties={properties}
      zugewiesen={zugewiesen}
      provisionProObjekt={provisionProObjekt}
      ownerId={ownerId}
      tenantCountry={kontoRes.ok ? kontoRes.data.tenant_country : null}
    />
  );
}
