// Buchhaltung → Angebote → Detail (Taskilo quotes/[quoteId]/page.tsx).
// Server-Hülle wie /buchhaltung: Tenant aus der Session, darunter die 1:1
// übernommene QuoteDetailView über den NewAuthProvider (user.uid = Tenant).
import { redirect } from "next/navigation";

import QuoteDetailView from "@/components/finance/QuoteDetailView";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getSession } from "@/lib/auth";

export default async function AngebotDetailPage() {
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
      <QuoteDetailView />
    </NewAuthProvider>
  );
}
