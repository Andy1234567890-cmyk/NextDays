// Die vollständige Beitragsübersicht mit Blättern (0474).
//
// UNTERSCHIED ZU `posts` (`beitraege.tsx`)
// `posts` ist der TEASER: „die letzten drei" auf einer beliebigen Seite, mit
// „Mehr anzeigen" innerhalb der geholten Menge. Dieser Baustein ist die
// ÜBERSICHT: alle Beiträge, echtes Blättern über eigene Adressen
// (`/blog?seite=2`), damit Seite 2 verlinkbar und für Suchmaschinen erreichbar
// ist.
//
// Warum nicht ein Schalter am Teaser: das Blättern ist der Unterschied, nicht
// die Zahl. Ein Teaser blättert innerhalb dessen, was schon im Browser liegt;
// eine Übersicht holt je Seite nach und trägt die Seitennummer in der Adresse.
// Beides in einem Baustein hieße, dass eine Einstellung entscheidet, ob es
// Adressen gibt — und Adressen sind Struktur, keine Darstellung.
//
// Server-Component, weil sie die Beiträge holt. Kein Nachladen im Browser: die
// Beiträge stehen schon in der Seite, wenn der Gast sie bekommt, und
// Suchmaschinen sehen sie ohne JavaScript.
import Link from "next/link";

import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { aktuellerHost } from "@/lib/host";
import { pickText } from "@/lib/i18n";
import { ladeBeitraege } from "@/lib/seo";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

/** Beiträge je Zeile → feste Klassen.
 *
 *  Feste Strings und keine Zusammensetzung: Tailwind liest den Quelltext und
 *  findet `sm:grid-cols-${n}` beim Bauen nicht — die Klasse fehlte dann im CSS,
 *  und das Raster bliebe einspaltig, ohne dass jemand den Grund sieht. Dieselbe
 *  Tabelle wie in `beitraege.tsx`; bewusst dort UND hier, weil eine geteilte
 *  Konstante zwei Bausteine aneinanderbände, deren Rasterwahl nichts
 *  miteinander zu tun hat.
 *
 *  Auf dem TELEFON steht immer ein Beitrag je Zeile — zwei Karten nebeneinander
 *  sind auf 375 px keine Karten mehr. */
const SPALTEN: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

function fahne(v: unknown, standard: boolean): boolean {
  return typeof v === "boolean" ? v : standard;
}

function zahl(v: unknown, standard: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : standard;
}

export async function BeitragslisteBlock({
  content,
  modus = NICHT_EDITIERBAR,
  seite = 1,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Die angezeigte Seite, aus `?seite=` der Adresse. 1-basiert wie im Link. */
  seite?: number;
}) {
  const t = texte(modus.locale);
  const host = await aktuellerHost();
  const proSeite = zahl(content.per_page, 9);
  // Eine Seite über die letzte hinaus wird nicht geraten, sondern gezeigt: die
  // Liste ist dann leer, und der Blätter-Verweis führt zurück. Ein stilles
  // Zurücksetzen auf Seite 1 wäre eine Adresse, die etwas anderes zeigt, als
  // sie sagt.
  const aktuelle = Math.max(1, Math.floor(seite));

  const liste = host
    ? await ladeBeitraege(host, {
        limit: proSeite,
        offset: (aktuelle - 1) * proSeite,
      })
    : null;

  const ueberschrift = pickText(content.headline, modus.locale);

  if (!liste || liste.items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={ueberschrift || undefined}
        grund={t.leerBeitraege}
      />
    );
  }

  const spalten = SPALTEN[zahl(content.columns, 3)] ?? SPALTEN[3];
  // Die Gesamtzahl kommt aus der Antwort des Servers (`total`), nicht aus der
  // Länge der geholten Seite: die ist auf `proSeite` begrenzt und ergäbe immer
  // „1 / 1".
  const seiten = Math.max(1, Math.ceil(liste.total / proSeite));

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-8">
      {ueberschrift ? (
        <h2 className="pb-6 font-display text-2xl font-semibold tracking-tight">
          {ueberschrift}
        </h2>
      ) : null}
      <ul className={`grid grid-cols-1 gap-8 ${spalten}`}>
        {liste.items.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/blog/${b.slug}`}
              className="group flex h-full flex-col gap-3"
            >
              {fahne(content.show_cover, true) && b.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.cover_image_url}
                  alt=""
                  loading="lazy"
                  className="aspect-[3/2] w-full rounded-2xl object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : null}
              <h3 className="font-display text-lg font-semibold group-hover:underline">
                {b.title}
              </h3>
              {/* Das ERSCHEINUNGSdatum, nicht `created_at`: „erschienen" ist
                  eine Aussage über die Website, „angelegt" eine über unsere
                  Datenbank (Wurzel 5b). Fehlt es, steht keine Zeile da. */}
              {fahne(content.show_date, true) && b.published_at ? (
                <p className="text-xs text-muted-foreground">
                  {b.published_at.slice(0, 10)}
                </p>
              ) : null}
              {fahne(content.show_author, false) && b.author ? (
                <p className="text-xs text-muted-foreground">{b.author}</p>
              ) : null}
              {fahne(content.show_excerpt, true) && b.excerpt ? (
                <p className="text-sm text-muted-foreground">{b.excerpt}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {seiten > 1 ? (
        <nav
          className="flex items-center justify-center gap-6 pt-10"
          aria-label={t.blogTitel}
        >
          {aktuelle > 1 ? (
            <Link href={`/blog?seite=${aktuelle - 1}`} className="text-sm underline">
              {t.blogVorheriger}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            {aktuelle} / {seiten}
          </span>
          {aktuelle < seiten ? (
            <Link href={`/blog?seite=${aktuelle + 1}`} className="text-sm underline">
              {t.blogNaechster}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
