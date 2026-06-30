// Startseite einer white-label Agentur-Site = die im Editor komponierte Home-Page
// (Block-Baum), gerendert pro Custom-Domain. KEIN Marktplatz-Klon.
import { headers } from "next/headers";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { SuchParams } from "@/lib/inserate";
import { ladeSeite } from "@/lib/site";
import { getSiteContext } from "@/lib/site-context";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; guests?: string; start?: string; end?: string }>;
}) {
  const { branding, unknown } = await getSiteContext();
  const host = await currentHost();

  if (unknown || !host) return <NotConfigured />;

  const site = await ladeSeite(host);
  // Keine veröffentlichte Home-Seite → neutraler Hinweis (kein Marktplatz).
  if (!site) return <NotConfigured />;

  const sp = await searchParams;
  const search: SuchParams = {
    q: sp.q,
    guests: sp.guests ? Number(sp.guests) : undefined,
    start: sp.start,
    end: sp.end,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader logoSrc={branding?.logo_url} logoAlt={branding?.site_name} />
      <main className="flex-1">
        <BlockRenderer
          blocks={site.blocks}
          tenantId={site.tenant_id}
          search={search}
        />
      </main>
      <SiteFooter siteName={branding?.site_name} />
    </div>
  );
}

async function currentHost(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return raw.split(":")[0]!.trim().toLowerCase() || null;
}

function NotConfigured() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-xl font-semibold">
        Diese Seite ist noch nicht eingerichtet
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Für diese Adresse ist noch keine Buchungs-Site veröffentlicht.
      </p>
    </div>
  );
}
