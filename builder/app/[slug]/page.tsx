// Unterseite einer Kunden-Site (z. B. /ueber-uns, /kontakt) = die im Baukasten
// komponierte Seite mit diesem Slug, gerendert pro Custom-Domain.
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import { ladeSeite } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

export default async function SlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const { branding, unknown } = await getSiteContext();
  const host = await aktuellerHost();

  if (unknown || !host) notFound();

  const site = await ladeSeite(host, slug);
  if (!site) notFound();

  // Die Sprache der Website, nicht ein festes „de". Vorher rendert JEDE
  // veröffentlichte Seite mit `NICHT_EDITIERBAR.locale` — also auf Deutsch, auch
  // die dänische Kundenseite, sobald deren Texte in beiden Sprachen gepflegt
  // waren.
  const sprache = spracheWaehlen(branding, lang);
  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      aktiverSlug={slug}
      jahr={new Date().getFullYear()}
      sprache={sprache}
    >
      <BlockRenderer
        blocks={site.blocks}
        tenantId={site.tenant_id}
        modus={{ aktiv: false, locale: sprache }}
      />
    </SiteShell>
  );
}
