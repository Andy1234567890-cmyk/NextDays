// Buchhaltung → Belege → <Belegart> → Neu.
// Server-Hülle wie rechnungen/neu: Tenant aus der Session, NewAuthProvider für
// den Bestands-Editor, darum die Belegart-Hülle (Titel, Nummernkreis,
// Pflichtfelder). EIN Editor für alle Arten — die Art steht im Pfad.
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { BelegEditorHuelle } from "@/components/buchhaltung/belege/beleg-editor-huelle";
import { belegartLabels } from "@/components/buchhaltung/belege/belegart-labels";
import { NewAuthProvider, type AuthUser } from "@/contexts/NewAuthContext";
import { getSession } from "@/lib/auth";
import { EDITOR_BELEGARTEN, istBelegart } from "@/lib/buchhaltung-belege-typen";

// Wird auf true gesetzt, sobald create-invoice/container.tsx `?belegart=`
// auswertet (Koordinator-Diff in BERICHT-belege.md, Abschnitt 5).
const BESTAND_LIEST_BELEGART = false;

export default async function BelegNeuPage({
  params,
}: {
  params: Promise<{ belegart: string }>;
}) {
  const { belegart } = await params;
  if (!istBelegart(belegart) || !EDITOR_BELEGARTEN.includes(belegart)) notFound();

  const { me, abgemeldet } = await getSession();
  if (abgemeldet) redirect("/login");
  if (!me) return null; // technischer Fehler — das Layout zeigt den Hinweis

  const t = await getTranslations("finance");
  const labels = belegartLabels(t);
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
      <BelegEditorHuelle
        belegart={belegart}
        label={labels[belegart]}
        bestandLiestBelegart={BESTAND_LIEST_BELEGART}
      />
    </NewAuthProvider>
  );
}
