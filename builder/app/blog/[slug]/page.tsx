// Ein Blog-Beitrag (0438, Etappe H).
//
// Der Beitrag ist eine Seite mit `page_type = 'post'` — dieselben Abschnitte,
// derselbe Renderer. Was hinzukommt, ist der Kopf (Titelbild, Datum, Autor) und
// das `Article`-Schema.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import { seitenMetadaten } from "@/lib/metadaten";
import { basisUrl } from "@/lib/seo";
import { ladeBeitrag } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  const daten = await ladeBeitrag(host, slug);
  if (!daten) return {};
  const meta = seitenMetadaten({ branding, host, page: daten.page });
  // Der Canonical eines Beitrags liegt unter /blog/<slug> und nicht unter
  // /<slug>: `seitenMetadaten` kennt nur Seiten und würde die falsche Adresse
  // bilden. Ein falscher Canonical nimmt die Seite aus dem Index — das ist der
  // teuerste Fehler, den diese Datei machen könnte.
  meta.alternates = { canonical: `${basisUrl(host)}/blog/${slug}` };
  return meta;
}

export default async function BeitragSeite({
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

  const daten = await ladeBeitrag(host, slug);
  if (!daten) notFound();

  const sprache = spracheWaehlen(branding, lang);
  const b = daten.post;

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
      tenantId={daten.tenant_id}
    >
      {/* Article-JSON-LD. Es steht hier und nicht in
          components/strukturierte-daten.tsx, weil nur diese Route die Felder
          hat — und weil ein Article-Schema auf einer Seite ohne Artikel ein
          Verstoß gegen Googles Richtlinie wäre.

          `dateModified` fehlt bewusst: wir führen kein verlässliches
          Änderungsdatum des TEXTES. `updated_at` beschreibt unsere
          Verarbeitung, und ein Beitrag, dessen Änderungsdatum bei jedem
          Deploy-Nebeneffekt springt, wäre eine Falschaussage (Wurzel 5b). */}
      {b.published_at ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: b.title,
              datePublished: b.published_at,
              ...(b.author
                ? { author: { "@type": "Person", name: b.author } }
                : {}),
              ...(b.cover_image_url ? { image: [b.cover_image_url] } : {}),
              ...(b.excerpt ? { description: b.excerpt } : {}),
              mainEntityOfPage: `${basisUrl(host)}/blog/${b.slug}`,
              ...(branding?.site_name
                ? {
                    publisher: {
                      "@type": "Organization",
                      name: branding.site_name,
                    },
                  }
                : {}),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {b.title}
        </h1>
        <p className="pt-3 text-sm text-muted-foreground">
          {b.published_at
            ? new Date(b.published_at).toLocaleDateString(sprache)
            : ""}
          {b.author ? ` · ${b.author}` : ""}
        </p>
        {b.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.cover_image_url}
            alt=""
            // Das Titelbild steht über der Falz und ist das LCP-Element dieser
            // Seite — es lädt sofort (dieselbe Begründung wie in lib/bilder.ts).
            loading="eager"
            fetchPriority="high"
            className="mt-8 w-full rounded-2xl object-cover"
          />
        ) : null}
      </article>

      <BlockRenderer
        blocks={daten.blocks}
        tenantId={daten.tenant_id}
        modus={{ aktiv: false, locale: sprache }}
      />
    </SiteShell>
  );
}
