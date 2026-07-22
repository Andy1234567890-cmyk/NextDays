// Eigentümer-Portal (Lastenheft §4.2): „Meine Abrechnungen" — der eingeloggte
// Eigentümer sieht read-only SEINE Auszahlungs-Abrechnungen. Der Endpunkt
// /owner-statements ist für die owner-Rolle serverseitig self-scoped
// (owners.user_id → eigene owner_id); ein owner_id-Parameter ist hier bewusst
// nicht nötig. Diese Route steht in OWNER_ALLOWED_HREFS (app-sidebar).
import { MyStatements } from "@/components/eigentuemer/my-statements";
import { listStatements } from "@/lib/owner-statements";

export const dynamic = "force-dynamic";

export default async function MeineAbrechnungenPage() {
  const res = await listStatements();
  return (
    <MyStatements
      statements={res.ok ? res.data.items : []}
      error={res.ok ? null : res.error}
    />
  );
}
