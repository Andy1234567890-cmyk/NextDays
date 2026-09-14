// Buchhaltung → Angebote → Bearbeiten (Taskilo quotes/[quoteId]/edit/page.tsx).
// Im Original eine 4 785-Zeilen-Kopie des Editors; hier läuft der EINE Editor
// (create-invoice/) im Angebot-Modus mit `editQuoteId`: er lädt das Angebot,
// befüllt das Formular und speichert per PATCH /quotes/{id} (angebote_bestand).
// Bis zum 14.09.2026 fehlte die Seite — ein gespeichertes Angebot war in der
// Oberfläche nicht mehr änderbar, nur anschaubar.
import { redirect } from "next/navigation";

import CreateDocumentForm from "@/components/finance/create-invoice/container";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getSession } from "@/lib/auth";

export default async function AngebotBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <CreateDocumentForm belegart="quote" editQuoteId={id} />
    </NewAuthProvider>
  );
}
