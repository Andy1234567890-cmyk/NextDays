// Multiplikatoren-Liste des Partnerprogramms (affiliate_leads, 0526): Coaches,
// Podcaster, Creator, Co-Hosting-Agenturen, die das Team gezielt anspricht.
// Die Namen leben in der Datenbank — nie im Repo (personenbezogene Daten).
import Link from "next/link";

import { PartnerLeads } from "@/components/partner-leads";
import { getLeads, type LeadKategorie, type LeadStatus } from "@/lib/partner";

export default async function LeadsSeite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const leads = await getLeads({
    status: (sp.status as LeadStatus | undefined) || undefined,
    category: (sp.category as LeadKategorie | undefined) || undefined,
    q: sp.q || undefined,
  });
  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">Multiplikatoren</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {leads.total} Einträge · mögliche Partner, die wir gezielt ansprechen. Nach Gewinn mit dem
            angelegten Partner verknüpfen.
          </p>
        </div>
        <Link
          href="/partner"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
        >
          Zurück zu Partner
        </Link>
      </div>
      <PartnerLeads
        leads={leads.items}
        filter={{ status: sp.status ?? "", category: sp.category ?? "", q: sp.q ?? "" }}
      />
    </div>
  );
}
