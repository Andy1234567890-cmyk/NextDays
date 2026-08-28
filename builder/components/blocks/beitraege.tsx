// Die Beitragsliste auf einer Seite (0438, ausgebaut 0457).
//
// Der Blog selbst liegt unter `/blog` — dieser Abschnitt bringt ihn auf jede
// andere Seite. Hostaway hat dafür zwei Katalogeinträge („Alle Beiträge" und
// „Neueste Beiträge"), die nach dem Einfügen DASSELBE Widget sind; bei uns ist
// es ein Typ mit Einstellungen. Der Unterschied zwischen den beiden ist genau
// eine Zahl (wie viele) und ein Schalter (Blättern ja/nein) — zwei
// Katalogeinträge dafür wären eine Erklärung, die man beim ersten Klick wieder
// vergisst.
//
// Server-Component, weil sie die Beiträge holt. Das Blättern übernimmt ein
// kleines Client-Stück (`beitraege-fenster.tsx`), das die FERTIG GERENDERTEN
// Karten durchreicht: so bleibt das Rendern serverseitig, und ein Klick auf
// „Mehr anzeigen" kostet keine zweite Anfrage.
import Link from "next/link";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { aktuellerHost } from "@/lib/host";
import { pickText } from "@/lib/i18n";
import { ladeBeitraege } from "@/lib/seo";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { BildNachweis } from "./bildnachweis";
import { BeitraegeFenster } from "./beitraege-fenster";

/** Beiträge je Zeile → feste Klassen.
 *
 *  Feste Strings und keine Zusammensetzung: Tailwind liest den Quelltext und
 *  findet `sm:grid-cols-${n}` beim Bauen nicht — die Klasse fehlt dann im CSS,
 *  und das Raster bliebe einspaltig, ohne dass jemand den Grund sieht.
 *
 *  Auf dem TELEFON steht immer ein Beitrag je Zeile. Das ist keine fehlende
 *  Einstellung, sondern dieselbe Grenze, die auch Hostaway zieht („nur Desktop
 *  und Tablet"): zwei Karten nebeneinander sind auf 375 px keine Karten mehr. */
const SPALTEN: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** Spalten für `masonry` — CSS-Spalten statt Grid.
 *
 *  Feste Strings, aus demselben Grund wie bei `SPALTEN`: Tailwind findet
 *  `sm:columns-${n}` beim Bauen nicht. Auf dem Telefon eine Spalte. */
const MASONRY_SPALTEN: Record<number, string> = {
  1: "",
  2: "sm:columns-2",
  3: "sm:columns-2 lg:columns-3",
  4: "sm:columns-2 lg:columns-4",
};

const ABSTAND: Record<string, string> = {
  sm: "gap-4",
  md: "gap-8",
  lg: "gap-12",
};

/** Abstand als CSS-Länge — für `masonry`, wo der Abstand ein Spaltenabstand
 *  ist und keine Grid-Lücke. Dieselben drei Werte wie `ABSTAND`, damit „mittel"
 *  in allen vier Anordnungen dasselbe bedeutet. */
const ABSTAND_LAENGE: Record<string, string> = {
  sm: "1rem",
  md: "2rem",
  lg: "3rem",
};

/** Die vier Anordnungen der Beitragsliste (`content.layout`).
 *
 *  Abgeleitet aus dem Marktstandard — Squarespace 7.1 führt fünf (Basic Grid ·
 *  Masonry · Single Column · Side by Side · Alternating Side by Side;
 *  recherchiert 27.08.2026), Hostaway nennt seine „Post Layouts". Bei uns sind
 *  es vier: die fünfte (abwechselnd links/rechts) ist keine eigene Aussage,
 *  und jede Art in der Auswahl MUSS hier gezeichnet werden — eine, die es
 *  nicht wird, wäre eine Attrappe (Wurzel 4).
 *
 *  `grid` ist der Standard und das bisherige Aussehen: ein neues Feld darf
 *  eine bestehende Kundenseite nicht umbauen (Wurzel 1). */
type Anordnung = "grid" | "masonry" | "list" | "side";

function anordnung(wert: unknown): Anordnung {
  return wert === "masonry" || wert === "list" || wert === "side"
    ? wert
    : "grid";
}

/** Wie viele Beiträge höchstens GEHOLT werden, wenn geblättert werden kann.
 *
 *  Der Deckel gehört hierher und nicht in die Einstellung (Wurzel 8): ohne ihn
 *  wäre „Seitenzahlen" ein Abruf über den ganzen Bestand, und auf einer
 *  Startseite mit dreihundert Beiträgen lädt niemand dreihundert Karten, um
 *  drei zu zeigen. Vier Fenster sind genug, um zu erkennen, dass es weitergeht;
 *  wer alles sehen will, klickt auf „Alle Beiträge". */
const MAX_GEHOLT = 36;

function zahl(wert: unknown, standard: number, min: number, max: number): number {
  return typeof wert === "number" && wert >= min && wert <= max ? wert : standard;
}

function schalter(wert: unknown, standard: boolean): boolean {
  return typeof wert === "boolean" ? wert : standard;
}

export async function BeitraegeBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const t = texte(modus.locale);
  const headline = pickText(content.headline, modus.locale);
  const host = await aktuellerHost();

  const anzahl = zahl(content.limit, 3, 1, 9);
  const spalten = zahl(content.per_row, 3, 1, 4);
  const zeilen = zahl(content.teaser_lines, 3, 0, 8);
  const navigation =
    content.navigation === "button" || content.navigation === "pages"
      ? content.navigation
      : "none";
  const bilder = schalter(content.show_thumbnails, true);
  const autorDatum = schalter(content.show_author_date, true);
  const einzeilig = schalter(content.single_line_title, false);
  const blognameZeigen = schalter(content.show_blog_name, false);
  const weiterlesenZeigen = schalter(content.show_read_more, false);
  const abstandName = String(content.gap ?? "md");
  const abstand = ABSTAND[abstandName] ?? ABSTAND.md;
  const art = anordnung(content.layout);
  // `per_row` wirkt nur bei den Raster-Arten — die Listen-Klasse unten liest
  // es gar nicht, wenn die Anordnung einspaltig ist. Wie bei Squarespace, wo
  // „Columns" nur an Basic Grid und Masonry hängt.
  //
  // Der gespeicherte Wert bleibt trotzdem stehen: wer die Art zurückstellt,
  // findet seine Spaltenzahl wieder (Wurzel 1). Deshalb wird er hier nicht
  // genullt, sondern nur nicht angewendet.
  // Die Schlagwörter stehen als Kommaliste im Inhalt (siehe `PostsContent`).
  // Aufgeteilt wird hier genauso wie im Backend: trimmen, Leeres weg, höchstens
  // acht — mehr kann ein Beitrag gar nicht tragen.
  const schlagworte =
    typeof content.tags === "string"
      ? content.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

  const liste = host
    ? await ladeBeitraege(host, {
        limit: navigation === "none" ? anzahl : Math.min(anzahl * 4, MAX_GEHOLT),
        tags: schlagworte.length ? schlagworte : undefined,
      })
    : null;

  if (!liste || liste.items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerBeitraege}
      />
    );
  }

  // Der Blogname, wenn der Kunde ihn anzeigen lässt. Fehlt er, steht der
  // übersetzte Standardtitel da — das ist ein Rückfall auf einen echten Text,
  // kein erfundener Name (Wurzel 4).
  const blogname = liste.blog.blog_name?.trim() || t.blogTitel;
  const weiterlesen = pickText(content.read_more, modus.locale) || t.blogWeiterlesen;

  const karten = liste.items.map((b) => (
    // `break-inside-avoid` nur für `masonry`: dort fließen die Karten durch
    // CSS-Spalten, und ohne das würde eine Karte am Spaltenende mitten im Text
    // umbrechen.
    <li key={b.slug} className={art === "masonry" ? "mb-8 break-inside-avoid" : ""}>
      <Link
        href={`/blog/${b.slug}`}
        className={
          "group flex h-full gap-3 " +
          // `side`: Bild NEBEN dem Text — auf dem Telefon trotzdem
          // untereinander, sonst bleiben von 375 px für jedes die Hälfte.
          (art === "side" ? "flex-col sm:flex-row sm:items-start sm:gap-6" : "flex-col")
        }
      >
        {bilder && b.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.cover_image_url}
            alt=""
            loading="lazy"
            className={
              "w-full rounded-2xl transition-transform group-hover:scale-[1.02] " +
              // `masonry` beschneidet NICHT — das ist der ganze Unterschied zu
              // `grid`: die Bilder behalten ihr Verhältnis, dadurch entsteht das
              // Mosaik. `h-auto object-contain` statt festem 3:2.
              (art === "masonry"
                ? "h-auto object-contain"
                : "aspect-[3/2] object-cover") +
              // `side`: das Bild nimmt ein Drittel und schrumpft nicht.
              (art === "side" ? " sm:w-1/3 sm:shrink-0" : "")
            }
          />
        ) : null}
        <div className={art === "side" ? "min-w-0 flex-1" : ""}>
          <h3
            className={
              "font-display text-lg font-bold " +
              (einzeilig ? "truncate" : "")
            }
          >
            {b.title}
          </h3>
          {zeilen > 0 && b.excerpt ? (
            <p
              className="overflow-hidden pt-1 text-sm text-muted-foreground"
              // `line-clamp-${n}` wäre wieder eine zusammengesetzte Klasse, die
              // Tailwind nicht findet. Als Stil steht die Zahl direkt da.
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: zeilen,
              }}
            >
              {b.excerpt}
            </p>
          ) : null}
          {autorDatum ? (
            <p className="pt-1 text-xs text-muted-foreground">
              {b.published_at
                ? new Date(b.published_at).toLocaleDateString(modus.locale)
                : ""}
              {b.author ? ` · ${b.author}` : ""}
            </p>
          ) : null}
          {weiterlesenZeigen ? (
            <p className="pt-2 text-sm font-semibold underline">{weiterlesen}</p>
          ) : null}
        </div>
      </Link>
      {/* Pflicht-Nachweis des Titelbildes — AUSSERHALB des Links: der Nachweis
          enthält selbst Links, und ein <a> in einem <a> ist ungültiges HTML.
          Ohne nachweispflichtiges Bild rendert er nichts. */}
      {bilder ? (
        <BildNachweis src={b.cover_image_url} variante="zeile" />
      ) : null}
    </li>
  ));

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          {blognameZeigen ? (
            <p className="text-sm font-semibold text-muted-foreground">
              {blogname}
            </p>
          ) : null}
          {headline ? (
            <h2
              {...editierbar(modus, "headline")}
              className="font-display text-3xl font-extrabold tracking-tight"
            >
              {headline}
            </h2>
          ) : null}
        </div>
        <Link href="/blog" className="text-sm font-semibold underline">
          {t.blogAlleAnsehen}
        </Link>
      </div>

      {/* Die Anordnung steckt in der Klasse der LISTE, nicht in den Karten:
          `grid`/`masonry` sind mehrspaltig, `list`/`side` einspaltig.
          `masonry` über CSS-Spalten (`columns-*`) und nicht über ein Grid — ein
          Grid richtet Zeilen aus, genau das soll hier nicht passieren. Und es
          braucht kein JavaScript, anders als die üblichen Masonry-Bibliotheken. */}
      <BeitraegeFenster
        proFenster={anzahl}
        navigation={navigation}
        mehrText={t.blogMehrAnzeigen}
        listenKlasse={
          art === "masonry"
            ? `pt-8 ${MASONRY_SPALTEN[spalten] ?? ""}`
            : art === "grid"
              ? `grid pt-8 ${abstand} ${SPALTEN[spalten] ?? ""}`
              : `flex flex-col pt-8 ${abstand}`
        }
        listenStil={
          art === "masonry"
            ? { columnGap: ABSTAND_LAENGE[abstandName] ?? ABSTAND_LAENGE.md }
            : undefined
        }
      >
        {karten}
      </BeitraegeFenster>
    </section>
  );
}
