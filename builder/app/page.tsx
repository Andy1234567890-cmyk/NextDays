// Startseite einer Kunden-Site = die im Baukasten komponierte Home-Page
// (geordnete Abschnitte), gerendert pro Custom-Domain. KEIN Marktplatz-Klon.
import type { Metadata } from "next";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { NichtEingerichtet } from "@/components/nicht-eingerichtet";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost, spracheAusPfad } from "@/lib/host";
import type { SuchParams } from "@/lib/inserate";
import { seitenMetadaten } from "@/lib/metadaten";
import { ladeSeite } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

/** Die <head>-Angaben der Startseite (0430).
 *
 *  Dieselbe Funktion wie bei den Unterseiten — der Titel bekommt hier nur
 *  keinen Marken-Zusatz angehängt, weil er auf der Startseite doppelt stünde. */
export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  const sprache = spracheWaehlen(branding, await spracheAusPfad());
  const site = await ladeSeite(host, undefined, null, sprache);
  if (!site) return {};
  return seitenMetadaten({ branding, host, page: site.page, sprache });
}

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

  const sp = await searchParams;
  // Das Pfad-Präfix ZUERST, `?lang=` als Altbestand — dieselbe Reihenfolge wie
  // in `app/[slug]/page.tsx`.
  //
  // Diese Zeilen fehlten hier: `generateMetadata` in derselben Datei las das
  // Präfix bereits, die Komponente nicht. `/da` lieferte damit einen dänischen
  // <title> über einem deutschen Seitenkörper — und `ladeSeite(host)` ohne
  // Sprache holte zusätzlich die falsche Fassung vom Resolver.
  const sprache = spracheWaehlen(branding, (await spracheAusPfad()) ?? sp.lang);

  const site = await ladeSeite(host, undefined, null, sprache);
  // Keine veröffentlichte Startseite → neutraler Hinweis (kein Marktplatz).
  if (!site) return <NichtEingerichtet />;

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
      sprache={sprache}
      seitenHtml={site.page.head_html}
      tenantId={site.tenant_id}
    >
      <BlockRenderer
        blocks={site.blocks}
        tenantId={site.tenant_id}
        search={search}
        modus={{ aktiv: false, locale: sprache }}
        seite={site.page}
      />
    </SiteShell>
  );
}
