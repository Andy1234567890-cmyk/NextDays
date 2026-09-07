// CRM · Partner & Deals (Liste). Server Component lädt die Partner.
import { notFound } from "next/navigation";

import { CrmNav } from "@/components/crm/crm-nav";
import { PartnersList } from "@/components/crm/partners-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { listPartners } from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function CrmPartnerPage() {
  const res = await listPartners();
  if (!res.ok) {
    if (res.status === 403) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">{res.error}</Card>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      {/* partners + deals: select-Grant + Publikation (0596), Lesen per RLS
        nur admin/co_admin. */}
      <RealtimeRefresh tables={["partners", "deals"]} />
      <CrmNav aktiv="partner" />
      <PartnersList initial={res.data.items} />
    </div>
  );
}
