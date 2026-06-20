// Buchhaltung → Rechnungen.
// Server-Komponente: ermittelt den Tenant aus der NextDays-Session (getMe) und
// rendert den echten Buchhaltungs-Bestand (InvoiceListView) über den Client-Wrapper.
// Der NewAuthProvider stellt dem Bestand den User (user.uid) bereit.
import { redirect } from "next/navigation";

import { InvoicesClient } from "@/components/finance/invoices-client";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getMe } from "@/lib/auth";

export default async function RechnungenPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const companyId = me.tenant_id ?? "";

  // NextDays-Session auf die vom Bestand erwartete AuthUser-Form mappen.
  const user: AuthUser = {
    id: me.user_id,
    uid: me.user_id,
    email: me.email ?? "",
    first_name: "",
    last_name: "",
    is_active: true,
    user_type: me.role ?? undefined,
    company_id: companyId,
  };

  return (
    <NewAuthProvider user={user}>
      <InvoicesClient companyId={companyId} />
    </NewAuthProvider>
  );
}
