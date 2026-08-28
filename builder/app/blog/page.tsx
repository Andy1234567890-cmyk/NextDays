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

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost, spracheAusPfad } from "@/lib/host";
import { hreflangKarte } from "@/lib/metadaten";
import { basisUrl, ladeBeitraege } from "@/lib/seo";
import { ladeSystemseitenVorlage } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { alleBildnachweise } from "@/lib/bildnachweis";
import { BildNachweis } from "@/components/blocks/bildnachweis";
import { spracheWaehlen } from "@/lib/sprache";
import { texte } from "@/lib/texte";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  const marke = branding?.site_name?.trim();
  // Der Blogname des Betriebs schlägt den Standardtitel (0457). Leer heißt
  // „nicht eingestellt" — dann steht der übersetzte Standard da, kein
  // erfundener Name.
  const liste = await ladeBeitraege(host, { limit: 1 });
  const titel =
    liste.blog.blog_name?.trim() || texte(spracheWaehlen(branding)).blogTitel;
  return {
    metadataBase: new URL(basisUrl(host)),
    title: marke ? `${titel} — ${marke}` : titel,
    alternates: {
      canonical: `${basisUrl(host)}/blog`,
      // Dieselbe hreflang-Karte wie bei Seiten und Beiträgen (0476).
      languages: hreflangKarte(branding, host, "/blog"),
    },
  };
}

/** Wie viele Beiträge eine Seite der Liste zeigt.
 *
 *  Der Deckel ist nicht einstellbar, und das ist Absicht: die Blog-Seite ist
 *  die vollständige Liste, nicht eine Kachel. Wer weniger zeigen will, nimmt
 *  den Abschnitt „Beiträge" auf einer eigenen Seite. */
const JE_SEITE = 12;

export default async function BlogSeite({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; lang?: string; q?: string; seite?: string }>;
}) {
  const { tag, lang, q, seite } = await searchParams;
  const { branding, unknown } = await getSiteContext();
  const host = await aktuellerHost();
  if (unknown || !host) notFound();

  // Das Pfad-Präfix ZUERST, `?lang=` als Altbestand (0476). Ohne diese Zeile
  // lieferte `/da/...` deutschen Inhalt mit Status 200 — der schlimmste Fall,
  // weil er wie ein Erfolg aussieht.
  const sprache = spracheWaehlen(
    branding,
    (await spracheAusPfad()) ?? lang,
  );
  const t = texte(sprache);
  // Die Seitenzahl kommt aus der Adresse und wird auf 1 gedeckelt, wenn dort
  // Unsinn steht. Kein Fehler dafür: eine Adresse mit `?seite=abc` ist ein
  // kaputter Link, und eine 404 dafür hilft niemandem.
  const nummer = Math.max(1, Math.min(200, Number.parseInt(seite ?? "1", 10) || 1));
  const suche = (q ?? "").trim().slice(0, 60);
  const liste = await ladeBeitraege(host, {
    limit: JE_SEITE,
    offset: (nummer - 1) * JE_SEITE,
    tag,
    q: suche || undefined,
  });
  // Der Titel der Seite: der Blogname des Betriebs, sonst der übersetzte
  // Standard.
  const blogname = liste.blog.blog_name?.trim() || t.blogTitel;
  /** Eine Adresse dieser Liste mit geänderten Angaben. Über EINEN Helfer,
   *  damit ein Filter beim Blättern nicht verlorengeht — genau das passiert,
   *  wenn jeder Link seine Parameter selbst zusammensetzt. */
  const adresse = (aender: Record<string, string | undefined>): string => {
    const qs = new URLSearchParams();
    // `lang` gehört dazu. Es fehlte hier, obwohl der Kommentar darüber genau
    // diesen Fall beschreibt: die Sprachwahl ging beim Blättern und beim
    // Tag-Filter verloren, und die nächste Seite kam in der Standardsprache.
    // Nur setzen, wenn es NICHT die Standardsprache ist — sonst trägt jede
    // Blog-Adresse einen Parameter, der nichts ändert (Duplicate Content).
    const werte = {
      tag,
      q: suche || undefined,
      seite: String(nummer),
      lang:
        sprache && sprache !== branding?.default_language ? sprache : undefined,
      ...aender,
    };
    for (const [k, v] of Object.entries(werte)) {
      if (v && !(k === "seite" && v === "1")) qs.set(k, v);
    }
    return qs.toString() ? `/blog?${qs.toString()}` : "/blog";
  };

  // Hat der Betrieb die Blog-Übersicht im Baukasten gestaltet (0474), gilt sie.
  //
  // Sie ERSETZT die eingebaute Liste und ergänzt sie nicht: beides
  // untereinander hieße die Beiträge doppelt, ohne dass jemand sähe, warum
  // (dieselbe Regel wie bei der Objektseite und beim Checkout).
  //
  // Damit zeigt der Menüpunkt „Layouts" im Blog-CMS endlich auf etwas: er
  // verweist auf die Bausteine dieser Seite und nannte sie „das Layout" — die
  // Seite hatte aber nie welche, weil ihr Aussehen hier fest stand.
  //
  // Die Filter und die Suche unten bleiben davon unberührt. Sie sind kein
  // Layout, sondern Funktion: eine gestaltete Übersicht ohne Suchfeld wäre eine
  // Übersicht, in der man nichts findet.
  const vorlage = await ladeSystemseitenVorlage(host, "blog");
  if (vorlage) {
    return (
      <SiteShell
        branding={branding}
        nav={navOf(branding)}
        jahr={new Date().getFullYear()}
        sprache={sprache}
      >
        <BlockRenderer
          blocks={vorlage.blocks}
          tenantId={vorlage.tenant_id}
          modus={{ aktiv: false, locale: sprache }}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
    >
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {blogname}
        </h1>

        {/* Das Suchfeld steht auf der Blog-Seite immer — der Abschnitt
            „Beitragssuche" bringt es zusätzlich auf andere Seiten und schickt
            genau hierher. Ein `form` mit `method="get"`: die Suche läuft ohne
            JavaScript, und das Ergebnis hat eine Adresse. */}
        <form action="/blog" method="get" role="search" className="flex gap-2 pt-6">
          {/* Siehe `beitragssuche.tsx`: bei `method="get"` baut der Browser die
              Query allein aus den Feldern, ein `?lang=` in der `action` wäre
              verworfen. Ohne dies verlor jede Suche die Sprachwahl. */}
          <input type="hidden" name="lang" value={sprache} />
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={suche}
            maxLength={60}
            placeholder={t.blogSuchePlatzhalter}
            aria-label={t.blogSuchePlatzhalter}
            className="w-full max-w-sm rounded-full border border-border bg-transparent px-5 py-2 text-sm outline-none focus:border-foreground"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
          >
            {t.sucheSuchen}
          </button>
        </form>

        {/* Die Filterleiste nur, wenn es Schlagwörter GIBT. Eine leere Leiste
            wäre ein Bedienelement ohne Funktion. */}
        {liste.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-6">
            <Link
              href={adresse({ tag: undefined, seite: "1" })}
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
                href={adresse({ tag: s, seite: "1" })}
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
          // Zwei verschiedene Aussagen, und sie dürfen nicht denselben Text
          // haben: „dieser Blog hat noch nichts" ist etwas anderes als „zu
          // diesem Suchwort gibt es nichts". Der erste Satz wäre bei einer
          // erfolglosen Suche schlicht falsch.
          <p className="pt-10 text-muted-foreground">
            {suche ? t.blogKeinTreffer : t.blogLeer}
          </p>
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
                {/* Pflicht-Nachweis des Titelbildes — AUSSERHALB des Links: der
                    Nachweis enthält selbst Links, und ein <a> in einem <a> ist
                    ungültiges HTML. Ohne nachweispflichtiges Bild rendert er
                    nichts. */}
                <BildNachweis
                  src={b.cover_image_url}
                  variante="zeile"
                  nachweise={alleBildnachweise(branding)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Blättern über die ADRESSE und nicht über einen Zustand im Browser:
            die Blog-Seite ist ein Ort, den man verschickt und der im Index
            steht. „Weiter" erscheint nur, wenn diese Seite voll ist — die
            Antwort sagt nicht, wie viele es insgesamt gibt, und eine geratene
            Gesamtzahl wäre eine Falschaussage (Wurzel 4). */}
        {nummer > 1 || liste.items.length === JE_SEITE ? (
          <div className="flex justify-between gap-4 pt-12">
            {nummer > 1 ? (
              <Link
                href={adresse({ seite: String(nummer - 1) })}
                rel="prev"
                className="rounded-full border border-border px-5 py-2 text-sm transition hover:bg-secondary"
              >
                ‹ {nummer - 1}
              </Link>
            ) : (
              <span />
            )}
            {liste.items.length === JE_SEITE ? (
              <Link
                href={adresse({ seite: String(nummer + 1) })}
                rel="next"
                className="rounded-full border border-border px-5 py-2 text-sm transition hover:bg-secondary"
              >
                {nummer + 1} ›
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
