// Ein Blog-Beitrag (0438, Etappe H).
//
// Der Beitrag ist eine Seite mit `page_type = 'post'` — dieselben Abschnitte,
// derselbe Renderer. Was hinzukommt, ist der Kopf (Titelbild, Datum, Autor) und
// das `Article`-Schema.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BeitragFelder } from "@/components/blog/beitrag-felder";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost, spracheAusPfad } from "@/lib/host";
import { hreflangKarte, seitenMetadaten } from "@/lib/metadaten";
import { basisUrl } from "@/lib/seo";
import { ladeBeitrag } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { alleBildnachweise } from "@/lib/bildnachweis";
import { BildNachweis } from "@/components/blocks/bildnachweis";
import { mitSprache, spracheWaehlen } from "@/lib/sprache";
import { sanitizeHtml } from "@/lib/sanitize";
import { texte } from "@/lib/texte";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  const sprache = spracheWaehlen(branding, await spracheAusPfad());
  const daten = await ladeBeitrag(host, slug, sprache);
  if (!daten) return {};
  const meta = seitenMetadaten({ branding, host, page: daten.page, sprache });
  // Der Canonical eines Beitrags liegt unter /blog/<slug> und nicht unter
  // /<slug>: `seitenMetadaten` kennt nur Seiten und würde die falsche Adresse
  // bilden. Ein falscher Canonical nimmt die Seite aus dem Index — das ist der
  // teuerste Fehler, den diese Datei machen könnte.
  //
  // NUR der Canonical wird ersetzt, nicht das ganze `alternates`-Objekt.
  // Vorher stand hier `meta.alternates = { canonical: … }` — das warf die
  // hreflang-Angaben (0476) still weg, die `seitenMetadaten` gerade gebaut
  // hatte. Ein Feld zu überschreiben ist etwas anderes, als das Objekt zu
  // ersetzen, in dem es liegt.
  const pfad = mitSprache(
    `/blog/${slug}`,
    sprache,
    branding?.default_language,
  );
  meta.alternates = {
    ...meta.alternates,
    canonical: `${basisUrl(host)}${pfad}`,
    // Die Sprachfassungen DIESES Beitrags — dieselbe Regel wie bei Seiten:
    // jede Fassung listet sich selbst und alle anderen, plus x-default.
    languages: hreflangKarte(branding, host, `/blog/${slug}`),
  };
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

  // Das Pfad-Präfix ZUERST, `?lang=` als Altbestand (0476). Ohne diese Zeile
  // lieferte `/da/...` deutschen Inhalt mit Status 200 — der schlimmste Fall,
  // weil er wie ein Erfolg aussieht.
  //
  // Und VOR dem Laden: der Resolver wählt die Sprachfassung anhand dieses
  // Werts. Danach wäre er zu spät.
  const sprache = spracheWaehlen(
    branding,
    (await spracheAusPfad()) ?? lang,
  );
  const daten = await ladeBeitrag(host, slug, sprache);
  if (!daten) notFound();
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
        {/* Pflicht-Nachweis des Titelbildes (Unsplash/Pexels). Diese Route
            rendert ihre Bilder ohne den BlockRenderer, hat das Branding aber
            zur Hand — deshalb die Liste direkt statt über den Kontext. */}
        {b.cover_image_url ? (
          <BildNachweis
            src={b.cover_image_url}
            variante="zeile"
            nachweise={alleBildnachweise(branding)}
          />
        ) : null}
        {/* Der Beitragstext (0480). Er steht im Beitrag selbst und nicht in
            Abschnitten — dieselbe Bauform wie im Vorbild.
            Die Typografie ist DIESELBE wie im Rich-Text-Baustein: zwei
            Schriftbilder für denselben Textkörper wären auf einer Website mit
            beidem sofort sichtbar.
            `sanitizeHtml` läuft trotz serverseitiger Allowlist mit — dasselbe
            tut der Rich-Text-Baustein, und es ist hier die zweite Schicht,
            nicht die erste. */}
        {/* Die VORLAGENFELDER (0483/0485). Sie stehen zwischen Titelbild und
            Beitragstext, weil Einordnung, voller Titel und Einleitung genau
            dorthin gehören — in die Maske sind sie in derselben Reihenfolge
            eingetragen.

            Bis zum 28.08.2026 erschienen sie NIRGENDS: gepflegt im CMS,
            gespeichert in `site_pages`, aber weder geladen noch gerendert. */}
        <BeitragFelder
          felder={b.felder}
          eigeneFelder={daten.eigene_felder}
          sprache={sprache}
        />

        {b.content_html ? (
          <div
            className="mt-8 text-lg leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-semibold [&_img]:mt-6 [&_img]:rounded-xl [&_li]:mt-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_table]:mt-6 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.content_html) }}
          />
        ) : null}
      </article>

      <BlockRenderer
        blocks={daten.blocks}
        tenantId={daten.tenant_id}
        modus={{ aktiv: false, locale: sprache }}
      />

      {/* Nächster/Vorheriger Beitrag (0457).
          Die Reihenfolge ist das Erscheinungsdatum und sonst nichts — sie ist
          bewusst nicht einstellbar, weil ein Blog eine Zeitachse ist. Wer eine
          kuratierte Abfolge will, meint eine Liste und keinen Blog; Hostaway
          hält es genauso.

          Welcher Beitrag der „nächste" ist, entscheidet der SERVER — und er
          lässt geplante Beiträge aus. Hier zu entscheiden hieße, die Planung an
          einer zweiten Stelle noch einmal zu prüfen, und genau das ist die
          Stelle, an der sie irgendwann fehlt. */}
      {daten.blog.prev_next && (daten.vorheriger || daten.naechster) ? (
        <nav
          aria-label={texte(sprache).blogAlleAnsehen}
          className="mx-auto max-w-3xl px-6 pb-16"
        >
          <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
            {daten.vorheriger ? (
              <Link
                href={`/blog/${daten.vorheriger.slug}`}
                rel="prev"
                className="group flex-1"
              >
                <span className="text-xs text-muted-foreground">
                  ‹ {texte(sprache).blogVorheriger}
                </span>
                <span className="block font-display font-bold group-hover:underline">
                  {daten.vorheriger.title}
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {daten.naechster ? (
              <Link
                href={`/blog/${daten.naechster.slug}`}
                rel="next"
                className="group flex-1 sm:text-right"
              >
                <span className="text-xs text-muted-foreground">
                  {texte(sprache).blogNaechster} ›
                </span>
                <span className="block font-display font-bold group-hover:underline">
                  {daten.naechster.title}
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        </nav>
      ) : null}
    </SiteShell>
  );
}
