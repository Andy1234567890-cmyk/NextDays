// „Letzte Beiträge" auf einer Seite (0438).
//
// Der Blog selbst liegt unter `/blog` — dieser Abschnitt bringt ihn auf die
// Startseite. Server-Component, weil er die Beiträge holt.
//
// Keine Filter, kein Blättern: wer nach Schlagwort filtern will, verlinkt
// `/blog?tag=…`. Ein zweiter Filtermechanismus hier wäre eine zweite Wahrheit
// über dieselbe Liste.
import Link from "next/link";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { aktuellerHost } from "@/lib/host";
import { pickText } from "@/lib/i18n";
import { ladeBeitraege } from "@/lib/seo";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

export async function BeitraegeBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const host = await aktuellerHost();
  const anzahl =
    typeof content.limit === "number" &&
    content.limit >= 1 &&
    content.limit <= 9
      ? content.limit
      : 3;
  const liste = host ? await ladeBeitraege(host, { limit: anzahl }) : null;

  if (!liste || liste.items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerBeitraege}
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        {headline ? (
          <h2
            {...editierbar(modus, "headline")}
            className="font-display text-3xl font-extrabold tracking-tight"
          >
            {headline}
          </h2>
        ) : (
          <span />
        )}
        <Link href="/blog" className="text-sm font-semibold underline">
          {texte(modus.locale).blogAlleAnsehen}
        </Link>
      </div>

      <ul className="grid gap-8 pt-8 sm:grid-cols-2 lg:grid-cols-3">
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
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
                {b.excerpt ? (
                  <p className="pt-1 text-sm text-muted-foreground">
                    {b.excerpt}
                  </p>
                ) : null}
                <p className="pt-1 text-xs text-muted-foreground">
                  {b.published_at
                    ? new Date(b.published_at).toLocaleDateString(modus.locale)
                    : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
