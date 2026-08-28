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

import { BeitragFelder } from "@/components/blog/beitrag-felder";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { CanvasBridge } from "@/components/blocks/canvas-bridge";
import { SiteShell } from "@/components/site-shell";
import { editierModusAus } from "@/lib/editier-kontext";
import { ladeSeitenEntwurf } from "@/lib/site";
import { sanitizeHtml } from "@/lib/sanitize";
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
        {/* IST DIE SEITE EIN BEITRAG, wird der Beitrag gezeichnet.
            ==================================================================
            Ein Blogbeitrag hat keine Abschnitte — sein Inhalt steht in
            `content_html` und den Beitragsfeldern (0483/0485). Diese Route
            rendert aber nur Blöcke, und deshalb war der Editor-iframe für
            einen Beitrag LEER: links „Keine Abschnitte", rechts eine weiße
            Fläche. Wer im Blog auf „Im Editor öffnen" klickte, sah von seinem
            Beitrag nichts (gemeldet am 28.08.2026).

            Dieselbe Bauform wie die öffentliche Beitragsseite
            (`app/blog/[slug]/page.tsx`) und dieselben Bausteine
            (`BeitragFelder`) — zwei Entwürfe wären zwei Behauptungen darüber,
            wie ein Beitrag aussieht.

            Die Blöcke kommen TROTZDEM darunter: ein Beitrag darf Abschnitte
            haben, er muss nur keine. */}
        {site.post ? (
          <article className="mx-auto max-w-3xl px-6 py-16">
            <h1 className="font-display text-4xl font-extrabold tracking-tight">
              {site.post.title}
            </h1>
            <p className="pt-3 text-sm text-muted-foreground">
              {site.post.published_at
                ? new Date(site.post.published_at).toLocaleDateString(
                    modus.locale,
                  )
                : ""}
              {site.post.author ? ` · ${site.post.author}` : ""}
            </p>
            {site.post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.post.cover_image_url}
                alt=""
                className="mt-8 w-full rounded-2xl object-cover"
              />
            ) : null}
            <BeitragFelder
              felder={site.post.felder ?? null}
              eigeneFelder={site.eigene_felder ?? []}
              sprache={modus.locale}
            />
            {site.post.content_html ? (
              <div
                className="mt-8 text-lg leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-semibold [&_img]:mt-6 [&_img]:rounded-xl [&_li]:mt-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
                // Serverseitig beim Speichern durch die nh3-Allowlist
                // gelaufen; `sanitizeHtml` ist hier die zweite Schicht,
                // dieselbe wie auf der öffentlichen Beitragsseite.
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(site.post.content_html),
                }}
              />
            ) : null}
          </article>
        ) : null}

        <BlockRenderer
          blocks={site.blocks}
          tenantId={site.tenant_id}
          modus={modus}
          seite={site.page}
        />
      </SiteShell>
    </div>
  );
}
