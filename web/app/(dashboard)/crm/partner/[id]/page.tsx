// CRM · Partner-Kartei mit Deals. Deals werden mitgeladen (null = Laden
// fehlgeschlagen → die Kartei zeigt den Fehler, statt leer zu wirken).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PartnerDetail } from "@/components/crm/partner-detail";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getPartner, listDeals } from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function CrmPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [partner, deals, t] = await Promise.all([
    getPartner(id),
    listDeals(id),
    getTranslations("crm"),
  ]);
  if (!partner.ok) {
    if (partner.status === 403 || partner.status === 404) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">{partner.error}</Card>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <RealtimeRefresh tables={["partners", "deals"]} />
      <Link href="/crm/partner" className="text-sm text-muted-foreground hover:underline">
        ← {t("partner.zurueck")}
      </Link>
      <PartnerDetail partner={partner.data} initialDeals={deals.ok ? deals.data.items : null} />
    </div>
  );
}
