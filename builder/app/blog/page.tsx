// Die Beitragsliste des Blogs (0438, Etappe H).
//
// Eine feste Route und kein Abschnitt: der Blog hat eine eigene Adresse
// (`/blog`), die man verlinken und in die Navigation legen kann. Ein
// Abschnitt „letzte Beiträge" für die Startseite ist etwas anderes und kommt
// zusätzlich — beides wollte Hostaway auch (All Posts als Widget UND eine
// Blog-Seite), nur ist bei ihnen die Blog-Seite eine normale Seite mit einem
// Widget darauf, was sie löschbar macht. Deren eigene Doku beschreibt, wie man
// sie danach wiederherstellt. Eine feste Route hat dieses Problem nicht.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import { basisUrl, ladeBeitraege } from "@/lib/seo";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";
import { texte } from "@/lib/texte";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  const marke = branding?.site_name?.trim();
  const titel = texte(spracheWaehlen(branding)).blogTitel;
  return {
    metadataBase: new URL(basisUrl(host)),
    title: marke ? `${titel} — ${marke}` : titel,
    alternates: { canonical: `${basisUrl(host)}/blog` },
  };
}

export default async function BlogSeite({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; lang?: string }>;
}) {
  const { tag, lang } = await searchParams;
  const { branding, unknown } = await getSiteContext();
  const host = await aktuellerHost();
  if (unknown || !host) notFound();

  const sprache = spracheWaehlen(branding, lang);
  const t = texte(sprache);
  const liste = await ladeBeitraege(host, { limit: 30, tag });

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
    >
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.blogTitel}
        </h1>

        {/* Die Filterleiste nur, wenn es Schlagwörter GIBT. Eine leere Leiste
            wäre ein Bedienelement ohne Funktion. */}
        {liste.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-6">
            <Link
              href="/blog"
              className={
                "rounded-full border px-3 py-1 text-sm transition " +
                (tag
                  ? "border-border hover:bg-secondary"
                  : "border-foreground bg-secondary font-semibold")
              }
            >
              {t.blogAlle}
            </Link>
            {liste.tags.map((s) => (
              <Link
                key={s}
                href={`/blog?tag=${encodeURIComponent(s)}`}
                className={
                  "rounded-full border px-3 py-1 text-sm transition " +
                  (tag === s
                    ? "border-foreground bg-secondary font-semibold"
                    : "border-border hover:bg-secondary")
                }
              >
                {s}
              </Link>
            ))}
          </div>
        ) : null}

        {liste.items.length === 0 ? (
          <p className="pt-10 text-muted-foreground">{t.blogLeer}</p>
        ) : (
          <ul className="grid gap-8 pt-10 sm:grid-cols-2">
            {liste.items.map((b) => (
              <li key={b.slug}>
                <Link href={`/blog/${b.slug}`} className="group flex flex-col gap-3">
                  {b.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.cover_image_url}
                      alt=""
                      loading="lazy"
                      className="aspect-[3/2] w-full rounded-2xl object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : null}
                  <div>
                    <h2 className="font-display text-xl font-bold">{b.title}</h2>
                    {b.excerpt ? (
                      <p className="pt-2 text-sm text-muted-foreground">
                        {b.excerpt}
                      </p>
                    ) : null}
                    <p className="pt-2 text-xs text-muted-foreground">
                      {/* Das Datum in der Sprache der Website, nicht in der des
                          Servers. `toLocaleDateString` ohne Locale nimmt die
                          des Systems — auf dem Server ist das nie die des
                          Gastes. */}
                      {b.published_at
                        ? new Date(b.published_at).toLocaleDateString(sprache)
                        : ""}
                      {b.author ? ` · ${b.author}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}
