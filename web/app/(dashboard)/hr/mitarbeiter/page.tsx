// Personal → Mitarbeitende (Kartei-Übersicht). Serverseitig geladen: `users`
// und `personal_akten` sind für authenticated gesperrt (Wurzel 6), ein
// Realtime-Abo wäre eine stumme Attrappe.
import { notFound } from "next/navigation";

import { MitarbeiterListe } from "@/components/personal/mitarbeiter-liste";
import { getAccount } from "@/lib/account";
import { getMe } from "@/lib/auth";
import { listMitarbeiter } from "@/lib/personal";

export const dynamic = "force-dynamic";

export default async function MitarbeiterPage() {
  const [res, me, konto] = await Promise.all([listMitarbeiter(), getMe(), getAccount()]);
  if (!res.ok && res.status === 403) notFound();
  return (
    <MitarbeiterListe
      daten={res.ok ? res.data : { items: [], kosten_monat: [], kosten_hinweise: [] }}
      loadError={res.ok ? null : res.error}
      kannAkte={me?.capabilities.includes("manage_personal") ?? false}
      tenantCountry={konto.ok ? konto.data.tenant_country : null}
    />
  );
}
