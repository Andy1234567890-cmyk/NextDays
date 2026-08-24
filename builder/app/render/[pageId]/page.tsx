// Entwurfs-Vorschau für den Website-Baukasten. Rendert eine Seite — AUCH
// unveröffentlicht — nur mit gültigem HMAC-Token (vom Backend signiert).
//
// Diese Route rendert die Seite VOLLSTÄNDIG: Kopfzeile, Abschnitte, Fußzeile,
// samt Theme, Farben und Schriften des Betriebs.
//
// Vorher zeigte sie nur die Abschnitte. Das war der Grund, warum ein
// Theme-Wechsel (Klar/Mitte/Karte/Seitlich) in der Vorschau nichts tat: das
// Theme bestimmt die KOPFZEILE, und die wurde gar nicht gerendert. Auch Farben
// und Schriften fehlten, weil das Layout sein Branding aus den Middleware-
// Headern liest — und die Middleware löst für diese Route keinen Tenant auf
// (sie hängt an einer Custom-Domain, die Vorschau läuft auf der Builder-Adresse).
//
// Deshalb setzt die Route ihre Marken-Tokens SELBST, aus dem Branding, das die
// Draft-Antwort ohnehin mitliefert. Damit sieht der Kunde in der Vorschau genau
// das, was der Gast später sieht.
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { CanvasBridge } from "@/components/blocks/canvas-bridge";
import { SiteShell } from "@/components/site-shell";
import { editierModusAus } from "@/lib/editier-kontext";
import { ladeSeitenEntwurf } from "@/lib/site";
import { navOf } from "@/lib/site-context";
import { brandStyle, siteFontsHref } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function DraftRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ token?: string; edit?: string; locale?: string }>;
}) {
  const { pageId } = await params;
  const sp = await searchParams;
  const { token } = sp;
  if (!token) notFound();
  // `edit` schaltet nur die Editier-Marker frei; der Zugriff hängt am Token.
  const modus = editierModusAus(sp);

  const site = await ladeSeitenEntwurf(pageId, token);
  if (!site) notFound();

  const branding = site.branding;
  const fontsHref = siteFontsHref(branding);

  return (
    // Die Marken-Tokens auf einem eigenen Wrapper statt auf <html>: das Layout
    // gehört allen Routen, diese Werte nur dieser Vorschau. Tailwind liest die
    // Variablen über die Vererbung, es macht also keinen Unterschied.
    <div
      style={brandStyle(branding)}
      data-button-style={branding?.button_style ?? undefined}
      className="min-h-screen bg-background text-foreground"
    >
      {/* React hebt <link rel="stylesheet"> im App Router selbst in den <head>.
          Ohne das stünde die Seite in der Fallback-Schrift, und die gewählte
          Schrift wäre in der Vorschau unsichtbar. */}
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <CanvasBridge editierbar={modus.aktiv} />
      <SiteShell
        branding={branding}
        nav={navOf(branding)}
        aktiverSlug={site.page.slug}
        jahr={new Date().getFullYear()}
        // Die Vorschau zeigt die Sprache, die im Editor gewählt ist — nicht die
        // Standardsprache der Website. Sonst bearbeitet der Kunde die dänische
        // Fassung und sieht daneben die deutsche.
        sprache={modus.locale}
        // Kein Google-Tag und keine strukturierten Daten im Editor-iframe
        // (0430): jeder Blick des Betriebs auf seine eigene Vorschau würde
        // sonst als Besuch in seiner Statistik landen.
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
