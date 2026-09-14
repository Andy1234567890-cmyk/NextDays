// Buchhaltung → Angebote.
// Server-Komponente wie /buchhaltung (Rechnungen): Tenant aus der NextDays-
// Session, darunter der echte Buchhaltungs-Bestand (QuotesClient →
// DocumentListView) über den NewAuthProvider. Ersetzt seit dem 13.09.2026 den
// NextDays-eigenen Angebots-Schieber (new-quote-button), der nicht dem
// übernommenen Taskilo-Werkzeug entsprach.
import { redirect } from "next/navigation";

import { QuotesClient } from "@/components/finance/quotes-client";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getSession } from "@/lib/auth";

export default async function AngebotePage() {
  // getSession statt getMe: nur eine ECHTE Abmeldung (401/403) darf umleiten,
  // ein technischer Fehler nicht (sonst meldet ein 503 den Nutzer ab).
  const { me, abgemeldet } = await getSession();
  if (abgemeldet) redirect("/login");
  if (!me) return null; // technischer Fehler — das Layout zeigt den Hinweis

  const companyId = me.tenant_id ?? "";

  // NextDays-Session auf die vom Bestand erwartete AuthUser-Form mappen.
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
      <QuotesClient companyId={companyId} />
    </NewAuthProvider>
  );
}
