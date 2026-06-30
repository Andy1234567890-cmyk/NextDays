// Unterseite einer white-label Agentur-Site (z.B. /ueber-uns, /kontakt) = die im
// Editor komponierte Seite mit diesem Slug, gerendert pro Custom-Domain.
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ladeSeite } from "@/lib/site";
import { getSiteContext } from "@/lib/site-context";

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { branding, unknown } = await getSiteContext();
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(":")[0]!
    .trim()
    .toLowerCase();

  if (unknown || !host) notFound();

  const site = await ladeSeite(host, slug);
  if (!site) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader logoSrc={branding?.logo_url} logoAlt={branding?.site_name} />
      <main className="flex-1">
        <BlockRenderer blocks={site.blocks} tenantId={site.tenant_id} />
      </main>
      <SiteFooter siteName={branding?.site_name} />
    </div>
  );
}
