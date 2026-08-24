// Unterseite einer Kunden-Site (z. B. /ueber-uns, /kontakt) = die im Baukasten
// komponierte Seite mit diesem Slug, gerendert pro Custom-Domain.
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { BrotkrumenDaten } from "@/components/strukturierte-daten";
import { aktuellerHost } from "@/lib/host";
import { seitenMetadaten } from "@/lib/metadaten";
import { basisUrl, ladeWeiterleitung, seitenPfad } from "@/lib/seo";
import { ladeSeite } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

/** Die <head>-Angaben dieser Seite (0430).
 *
 *  Next ruft das VOR der Komponente auf. Beide holen dieselbe Seite, aber
 *  `ladeSeite` ist in `cache()` gewickelt — es wird pro Request nur einmal
 *  wirklich abgerufen.
 *
 *  Findet sich keine Seite, bleiben die Metadaten leer statt eine erfundene
 *  Beschreibung zu tragen. Die Komponente entscheidet danach, ob weitergeleitet
 *  oder 404 gezeigt wird; das hier ist kein guter Ort dafür, weil Next
 *  Metadaten auch für Fehlerseiten auswertet. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  const site = await ladeSeite(host, slug);
  if (!site) return {};
  return seitenMetadaten({ branding, host, page: site.page });
}

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
  if (!site) {
    // Keine Seite unter diesem Pfad — jetzt und NUR jetzt zählt eine
    // Weiterleitung (0430). Die Reihenfolge ist unverhandelbar: eine
    // existierende Seite hat Vorrang, sonst wäre sie über ihre eigene Adresse
    // unerreichbar, sobald jemand versehentlich eine Weiterleitung darauf legt.
    const ziel = await ladeWeiterleitung(host, `/${slug}`);
    if (ziel) {
      // 301 gibt die Suchmaschinen-Platzierung der alten Adresse an die neue
      // weiter, 302 behält sie bei der alten. Der Unterschied ist der ganze
      // Grund, warum der Kunde zwischen beiden wählen kann — ihn hier
      // einzuebnen würde die Einstellung zur Attrappe machen.
      //
      // Beide Funktionen werfen (Next signalisiert die Weiterleitung als
      // Ausnahme), deshalb steht danach kein `return`.
      if (ziel.redirect_type === 301) permanentRedirect(ziel.target);
      redirect(ziel.target);
    }
    notFound();
  }

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
      seitenHtml={site.page.head_html}
      tenantId={site.tenant_id}
    >
      <BrotkrumenDaten
        branding={branding}
        basisUrl={basisUrl(host)}
        titel={site.page.title}
        pfad={seitenPfad(site.page.slug)}
      />
      <BlockRenderer
        blocks={site.blocks}
        tenantId={site.tenant_id}
        modus={{ aktiv: false, locale: sprache }}
      />
    </SiteShell>
  );
}
