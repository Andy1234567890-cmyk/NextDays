// Buchhaltung → Angebote → Neu (Taskilo quotes/create/page.tsx).
// Der alte Angebots-Editor war eine 4 552-Zeilen-Kopie des Rechnungs-Editors;
// hier läuft der EINE übernommene Editor (create-invoice/) im Angebot-Modus:
// Titel/Nummernkreis „Angebot", „Gültig bis" statt Zahlungsziel, Speichern über
// POST /quotes, Versand-Dialog als Angebot. Server-Hülle wie rechnungen/neu.
import { redirect } from "next/navigation";

import CreateDocumentForm from "@/components/finance/create-invoice/container";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getSession } from "@/lib/auth";

export default async function AngebotNeuPage() {
  const { me, abgemeldet } = await getSession();
  if (abgemeldet) redirect("/login");
  if (!me) return null; // technischer Fehler — das Layout zeigt den Hinweis

  const companyId = me.tenant_id ?? "";
  const user: AuthUser = {
    id: me.user_id,
    uid: companyId, // Bestand nutzt user.uid als companyId/Tenant
    email: me.email ?? "",
    first_name: "",
    last_name: "",
    is_active: true,
    user_type: me.role ?? undefined,
    company_id: companyId,
  };

  return (
    <NewAuthProvider user={user}>
      <CreateDocumentForm belegart="quote" />
    </NewAuthProvider>
  );
}
