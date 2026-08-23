// Startseite einer Kunden-Site = die im Baukasten komponierte Home-Page
// (geordnete Abschnitte), gerendert pro Custom-Domain. KEIN Marktplatz-Klon.
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { NichtEingerichtet } from "@/components/nicht-eingerichtet";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import type { SuchParams } from "@/lib/inserate";
import { ladeSeite } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    guests?: string;
    start?: string;
    end?: string;
    /** Sprachwahl des Besuchers (Sprachwähler in der Kopfzeile). */
    lang?: string;
  }>;
}) {
  const { branding, unknown } = await getSiteContext();
  const host = await aktuellerHost();

  if (unknown || !host) return <NichtEingerichtet />;

  const site = await ladeSeite(host);
  // Keine veröffentlichte Startseite → neutraler Hinweis (kein Marktplatz).
  if (!site) return <NichtEingerichtet />;

  const sp = await searchParams;
  const search: SuchParams = {
    q: sp.q,
    guests: sp.guests ? Number(sp.guests) : undefined,
    start: sp.start,
    end: sp.end,
  };

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      aktiverSlug=""
      jahr={new Date().getFullYear()}
      sprache={spracheWaehlen(branding, sp.lang)}
    >
      <BlockRenderer
        blocks={site.blocks}
        tenantId={site.tenant_id}
        search={search}
        modus={{ aktiv: false, locale: spracheWaehlen(branding, sp.lang) }}
      />
    </SiteShell>
  );
}
