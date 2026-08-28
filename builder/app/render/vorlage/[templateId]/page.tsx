// Vorschau einer VORLAGE im Baukasten — dieselbe Bühne wie die Entwurfs-Vorschau,
// nur mit Daten, die es in der Datenbank noch gar nicht gibt.
//
// Warum eine eigene Route und nicht `/render/[pageId]`: eine Vorlage hat keine
// Seiten-ID, sie ist ein Fixture. Sie hier trotzdem durch DENSELBEN Renderer zu
// schicken ist der ganze Punkt — was der Kunde in der Galerie sieht, ist Zeile
// für Zeile dieselbe Ausgabe wie später seine Seite. Eine nachgebaute Vorschau
// im Dashboard wäre der Doppel-Renderer, den wir hier gerade abgeschafft haben.
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { editierModusAus } from "@/lib/editier-kontext";
import { ladeVorlagenEntwurf } from "@/lib/site";
import { navOf } from "@/lib/site-context";
import { brandStyle, siteFontsHref } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function VorlagenRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ token?: string; slug?: string; locale?: string }>;
}) {
  const { templateId } = await params;
  const sp = await searchParams;
  const { token } = sp;
  if (!token) notFound();

  const site = await ladeVorlagenEntwurf(templateId, token, sp.slug ?? "");
  if (!site) notFound();

  const branding = site.branding;
  const fontsHref = siteFontsHref(branding);
  // Die Vorlage ist NICHT bearbeitbar: sie gehört noch niemandem. Erst nach dem
  // Übernehmen entstehen echte Seiten, und die haben ihren eigenen Editor.
  const modus = editierModusAus({ locale: sp.locale });

  return (
    <div
      style={brandStyle(branding)}
      data-button-style={branding?.button_style ?? undefined}
      className="min-h-screen bg-background text-foreground"
    >
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <SiteShell
        branding={branding}
        nav={navOf(branding)}
        aktiverSlug={site.page.slug}
        jahr={new Date().getFullYear()}
        sprache={modus.locale}
        vorschau
      >
        <BlockRenderer
          blocks={site.blocks}
          tenantId={site.tenant_id}
          modus={modus}
        />
      </SiteShell>
    </div>
  );
}
