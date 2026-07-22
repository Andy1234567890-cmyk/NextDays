// Buchhaltung → Rechnungen → Neu.
// Server-Hülle: ermittelt den Tenant aus der NextDays-Session (getMe) und
// stellt ihn dem echten Rechnungserstellungs-Formular (1:1 aus dem Bestand)
// über den NewAuthProvider bereit (user.uid = tenant_id).
import { redirect } from "next/navigation";

import CreateInvoiceForm from "@/components/finance/create-invoice-page";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getMe } from "@/lib/auth";

export default async function RechnungNeuPage() {
  const me = await getMe();
  if (!me) redirect("/login");

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
      <CreateInvoiceForm />
    </NewAuthProvider>
  );
}
