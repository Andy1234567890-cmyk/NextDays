// CRM · Leads (Eigentümer-Akquise). Server Component lädt Leads + Team.
import { notFound } from "next/navigation";

import { CrmNav } from "@/components/crm/crm-nav";
import { LeadsBoard } from "@/components/crm/leads-board";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { listTenantUsers } from "@/lib/account";
import { getMe } from "@/lib/auth";
import { listLeads } from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function CrmLeadsPage() {
  const [leads, team, me] = await Promise.all([
    // Obergrenze des Endpunkts (200); die Filter laufen clientseitig über
    // diese Menge. Ein Betrieb mit mehr offenen Leads bekommt Paginierung,
    // sobald es ihn gibt — heute wäre sie ein Feature ohne Nutzer.
    listLeads({ limit: 200 }),
    listTenantUsers(),
    getMe(),
  ]);
  if (!leads.ok) {
    // Fehlende Berechtigung (manage_crm) ist kein Fehler, sondern „gibt es
    // für dich nicht" — die Sidebar blendet den Eintrag ohnehin aus (Wurzel 3).
    if (leads.status === 403) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">{leads.error}</Card>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-6">
      {/* leads + lead_notes: select-Grant für authenticated + Publikation
        (0596/0597), Lesen per RLS nur admin/co_admin — genau die Rollen, die
        diese Seite sehen. */}
      <RealtimeRefresh tables={["leads", "lead_notes"]} />
      <CrmNav aktiv="leads" />
      {!team.ok && (
        <Card className="p-4 text-sm text-destructive">{team.error}</Card>
      )}
      <LeadsBoard
        initial={leads.data.items}
        total={leads.data.total}
        team={team.ok ? team.data : []}
        accommodationType={me?.accommodation_type === "hotel" ? "hotel" : "vacation_rental"}
      />
    </div>
  );
}
