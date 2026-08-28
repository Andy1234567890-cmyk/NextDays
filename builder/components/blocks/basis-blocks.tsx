// Die Basis-Abschnitte des Baukastens (0450): Accordion, Tabelle, Liste,
// Dateien, Copyright, Brotkrumen.
//
// Alle sechs sind SERVER-Komponenten und kommen ohne eine Zeile Client-Code
// aus. Das ist keine Sparsamkeit, sondern die Eigenschaft, die sie brauchbar
// macht: sie stehen auf Gästeseiten, die schnell laden sollen, und keiner von
// ihnen hat einen Zustand, der sich ohne Nachladen ändert.
//
// Das Accordion nutzt `<details>`/`<summary>` — wie der FAQ-Block und aus
// demselben Grund: Tastaturbedienung, Screenreader-Ansage und die
// Browser-Suche (Strg+F findet auch Text in einem geschlossenen `<details>`)
// bringt das Element von sich aus mit. Jede Nachbildung mit `useState`
// verliert mindestens eines davon.
//
// Reiter (`tabs`) und Countdown liegen NICHT hier: beide brauchen den Browser
// (Umschalten, laufende Uhr) und stehen deshalb in eigenen Client-Dateien.
import { Icon } from "@iconify/react";

import { type BildLaden } from "@/lib/bilder";
import {
  type EditierModus,
  NICHT_EDITIERBAR,
  editierbar,
} from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize";
import type { TrailItem } from "@/lib/site";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { BildNachweis } from "./bildnachweis";

/** Kurzer, stabiler Schlüssel aus einer Zeichenkette (djb2).
 *
 *  Gebraucht für die Gruppe des exklusiven Accordions: mehrere `<details>` mit
 *  demselben `name` klappen einander zu — und genau das soll innerhalb EINES
 *  Abschnitts passieren, zwischen zwei Abschnitten aber nicht. Ein Zähler
 *  („akkordeon-1") ginge nicht: der Renderer baut die Blöcke parallel und weiß
 *  an dieser Stelle nicht, der wievielte er ist.
 *
 *  Kein `crypto`: das ist kein Sicherheitsmerkmal, sondern eine Unterscheidung.
 *  Eine Kollision kostet nichts weiter als zwei Accordions, die einander
 *  zuklappen — und sie setzt voraus, dass zwei Abschnitte auf derselben Seite
 *  wortgleiche Titel tragen. Der vorherige Schlüssel (Zeichenzahl + Anzahl) kam
 *  dagegen schon bei zwei verschiedenen Accordions mit gleich langen Titeln ins
 *  Gehege. */
function kurzHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Überschrift eines Abschnitts — dieselbe Typografie wie in Karte und FAQ.
 *
 *  Als eigene Komponente, weil sie in dieser Datei sechsmal vorkäme. Ohne
 *  Überschrift entfällt das Element ganz: eine leere `<h2>` wäre eine
 *  Leerzeile, die niemand erklärt bekommt. */
function Ueberschrift({
  text,
  modus,
}: {
  text: string;
  modus: EditierModus;
}) {
  if (!text) return null;
  return (
    <h2
      {...editierbar(modus, "headline")}
      className="pb-6 font-display text-3xl font-extrabold tracking-tight"
    >
      {text}
    </h2>
  );
}

// =========================================================================
// Accordion
// =========================================================================

type AccordionEintrag = { title?: unknown; text?: unknown };

export function AccordionBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items)
    ? (content.items as AccordionEintrag[])
    : [];
  // Ein Eintrag ohne Titel wird weggelassen: sichtbar wäre er eine leere
  // Zeile, die sich aufklappen lässt. Ein Eintrag mit Titel und ohne Inhalt
  // bleibt dagegen — er ist eine Überschrift, die (noch) nichts verbirgt, und
  // das ist eine Entscheidung des Betriebs, keine Lücke.
  const items = roh
    .map((e) => ({
      titel: pickText(e.title, modus.locale).trim(),
      html: sanitizeHtml(pickText(e.text, modus.locale)),
    }))
    .filter((e) => e.titel);

  if (items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerAccordion}
      />
    );
  }

  // `name` macht aus mehreren `<details>` ein EXKLUSIVES Accordion: der Browser
  // schließt die anderen selbst. Ohne eine Zeile JavaScript, und in Browsern,
  // die das Attribut nicht kennen, bleiben schlicht mehrere Einträge offen —
  // ein Verhalten, das Hostaway ebenfalls als Wahlmöglichkeit anbietet.
  //
  // Der Name muss je Abschnitt EINDEUTIG sein, sonst würden zwei Accordions auf
  // derselben Seite einander zuklappen. Die Überschrift taugt nicht als
  // Schlüssel (sie darf leer sein und doppelt vorkommen), deshalb hängt er an
  // den Titeln der Einträge.
  const gruppe =
    content.single_open === false
      ? undefined
      : `akk-${kurzHash(items.map((i) => i.titel).join("\u0000"))}`;
  const ersterOffen = content.first_open === true;

  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      <div className="divide-y divide-border border-y border-border">
        {items.map((e, i) => (
          <details
            key={`${e.titel}-${i}`}
            name={gruppe}
            open={ersterOffen && i === 0}
            className="group py-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-semibold">
              {e.titel}
              <Icon
                icon="ph:plus"
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
              />
            </summary>
            {e.html ? (
              <div
                className="pt-3 text-base leading-relaxed text-foreground/80 [&_a]:text-primary [&_a]:underline [&_p]:mt-3"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: e.html }}
              />
            ) : null}
          </details>
        ))}
      </div>
    </section>
  );
}

// =========================================================================
// Tabelle
// =========================================================================

export function TabelleBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const kopf = Array.isArray(content.header)
    ? (content.header as Array<Record<string, unknown>>).map((c) =>
        pickText(c.title, modus.locale),
      )
    : [];
  const zeilen = Array.isArray(content.rows)
    ? (content.rows as unknown[]).filter(Array.isArray).map((r) =>
        (r as unknown[]).map((z) => (typeof z === "string" ? z : "")),
      )
    : [];

  if (zeilen.length === 0 && kopf.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerTabelle}
      />
    );
  }

  const erste = content.highlight_first_column !== false;
  // Wie viele Spalten die Tabelle wirklich hat: die längste Zeile entscheidet,
  // nicht der Kopf. Eine Zeile mit mehr Zellen als Kopfspalten ist erlaubt
  // (Kopf ist optional), und ihre Zellen dürfen nicht verschwinden.
  const spalten = Math.max(
    kopf.length,
    ...zeilen.map((z) => z.length),
    0,
  );

  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      {/* Der eigene Scroll-Rahmen ist Pflicht und keine Kosmetik: eine Tabelle
          darf bis 30 Spalten haben, und ohne ihn schöbe sie auf dem Telefon
          die GANZE Seite zur Seite. */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          {kopf.length > 0 ? (
            <thead className="bg-secondary/60">
              <tr>
                {Array.from({ length: spalten }, (_, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    {kopf[i] ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody className="divide-y divide-border">
            {zeilen.map((zeile, zi) => (
              <tr key={zi} className={zi % 2 ? "bg-secondary/20" : undefined}>
                {Array.from({ length: spalten }, (_, si) => {
                  const wert = zeile[si] ?? "";
                  // Die erste Spalte ist fast immer die Zeilenbeschriftung —
                  // deshalb `<th scope="row">` und nicht `<td>`. Das ist keine
                  // Optik: ein Screenreader nennt damit bei jeder Zelle, zu
                  // welcher Zeile sie gehört.
                  return si === 0 && erste ? (
                    <th
                      key={si}
                      scope="row"
                      className="px-4 py-3 font-semibold"
                    >
                      {wert}
                    </th>
                  ) : (
                    <td key={si} className="px-4 py-3 text-foreground/80">
                      {wert}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// =========================================================================
// Liste
// =========================================================================

type ListenEintrag = {
  image_url?: unknown;
  title?: unknown;
  text?: unknown;
  link_href?: unknown;
  link_label?: unknown;
};

export function ListeBlock({
  content,
  modus = NICHT_EDITIERBAR,
  laden = "lazy",
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  laden?: BildLaden;
}) {
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items)
    ? (content.items as ListenEintrag[])
    : [];
  const items = roh
    .map((e) => ({
      bild: typeof e.image_url === "string" ? e.image_url : null,
      titel: pickText(e.title, modus.locale).trim(),
      text: pickText(e.text, modus.locale).trim(),
      href: typeof e.link_href === "string" ? e.link_href : null,
      linkText: pickText(e.link_label, modus.locale).trim(),
    }))
    // Ein Eintrag ganz ohne Titel und Text ist ein leerer Posten — weg damit.
    .filter((e) => e.titel || e.text);

  if (items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerListe}
      />
    );
  }

  const layout =
    content.layout === "grid" || content.layout === "numbered"
      ? content.layout
      : "stacked";
  const nummeriert = layout === "numbered";
  const raster = layout === "grid";

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      <ol
        className={
          raster
            ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            : "divide-y divide-border"
        }
      >
        {items.map((e, i) => (
          <li
            key={`${e.titel}-${i}`}
            className={
              raster
                ? "flex flex-col gap-3 rounded-2xl border border-border p-5"
                : "flex items-start gap-4 py-5"
            }
          >
            {nummeriert ? (
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                {i + 1}
              </span>
            ) : null}
            {e.bild ? (
              // Bild und sein Pflicht-Nachweis gehoeren zusammen und stehen
              // deshalb in EINER Huelle. Ohne Nachweis rendert `BildNachweis`
              // nichts — die Huelle bleibt dann eine leere Umrandung um das
              // Bild und aendert nichts am Aussehen bestehender Seiten.
              <span className={raster ? "block w-full" : "block shrink-0"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.bild}
                  alt=""
                  loading={i === 0 ? laden : "lazy"}
                  className={
                    raster
                      ? "aspect-video w-full rounded-xl object-cover"
                      : "size-20 rounded-xl object-cover"
                  }
                />
                <BildNachweis src={e.bild} variante="zeile" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              {e.titel ? (
                <p className="text-base font-semibold">{e.titel}</p>
              ) : null}
              {e.text ? (
                <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                  {e.text}
                </p>
              ) : null}
              {e.href ? (
                <a
                  href={e.href}
                  className="inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary underline underline-offset-4"
                >
                  {/* Ohne eigene Beschriftung steht der neutrale Renderer-Text
                      da — nicht die Adresse und kein erfundener Satz. */}
                  {e.linkText || texte(modus.locale).listeMehr}
                  <Icon icon="ph:arrow-right" aria-hidden className="size-3.5" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// =========================================================================
// Dateien zum Herunterladen
// =========================================================================

/** Der Dateiname aus einer Adresse — der Rückfall, wenn keine Beschriftung
 *  gesetzt ist.
 *
 *  Bewusst kein erfundener Text („Datei 1"): der Dateiname steht in der
 *  Adresse, er ist echt, und er sagt dem Gast mehr als eine Nummer. Lässt er
 *  sich nicht ermitteln (Adresse endet auf `/`), bleibt es leer und der
 *  Renderer nimmt seinen eigenen neutralen Text. */
function dateiName(url: string): string {
  try {
    const pfad = url.split(/[?#]/)[0] ?? "";
    return decodeURIComponent(pfad.split("/").pop() ?? "");
  } catch {
    // Eine kaputte Prozent-Kodierung lässt `decodeURIComponent` werfen. Das ist
    // kein Grund, den ganzen Abschnitt zu verlieren.
    return "";
  }
}

type DateiEintrag = { url?: unknown; label?: unknown };

export function DateienBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items)
    ? (content.items as DateiEintrag[])
    : [];
  const items = roh
    .filter((e) => typeof e.url === "string" && e.url)
    .map((e) => {
      const url = e.url as string;
      return {
        url,
        text:
          pickText(e.label, modus.locale).trim() ||
          dateiName(url) ||
          texte(modus.locale).dateiHerunterladen,
      };
    });

  if (items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerDateien}
      />
    );
  }

  // `noindex` ist KEIN Schutz und wird auch nicht als solcher angeboten — es
  // ist die Bitte an Suchmaschinen, die Datei nicht zu listen. Wer sie kennt,
  // kann sie weiterhin laden; das steht so auch im Hinweis der Oberfläche.
  const rel = content.noindex === true ? "nofollow noopener" : "noopener";

  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      <ul className="flex flex-col gap-2">
        {items.map((e, i) => (
          <li key={`${e.url}-${i}`}>
            <a
              href={e.url}
              // `download` bittet den Browser zu speichern statt anzuzeigen. Bei
              // fremder Herkunft ignorieren Browser das Attribut — dann öffnet
              // die Datei, und das ist der ehrlichere Ausgang als ein Knopf,
              // der scheinbar nichts tut.
              download
              rel={rel}
              className="flex items-center gap-3 rounded-2xl border border-border px-5 py-4 transition hover:bg-secondary"
            >
              <Icon
                icon="ph:file-arrow-down"
                aria-hidden
                className="size-5 shrink-0 text-primary"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {e.text}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =========================================================================
// Copyright
// =========================================================================

export function CopyrightBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const text = pickText(content.text, modus.locale).trim();
  // Das Jahr kommt aus der Uhr, nicht aus den Daten — genau das ist der Zweck
  // des Abschnitts (Hostaway: „the year will automatically update"). Kein
  // Verstoß gegen Wurzel 5b: dort geht es um den Zeitpunkt eines FREMDEN
  // Ereignisses. Das laufende Jahr einer Copyright-Zeile IST „heute".
  const jahr = new Date().getFullYear();
  const marke = `© ${jahr}`;
  const umgedreht = content.reverse === true;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
      <p {...editierbar(modus, "text")}>
        {umgedreht ? (
          <>
            {text ? `${text} ` : ""}
            {marke}
          </>
        ) : (
          <>
            {marke}
            {text ? ` ${text}` : ""}
          </>
        )}
      </p>
    </div>
  );
}

// =========================================================================
// Brotkrumen
// =========================================================================

export function BrotkrumenBlock({
  content,
  modus = NICHT_EDITIERBAR,
  trail = [],
  aktuellerTitel = "",
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Der Weg von oben bis zur Elternseite — aus dem Resolver, nicht aus dem
   *  `content`. Die Seitenhierarchie kennt nur der Server. */
  trail?: TrailItem[];
  /** Titel der Seite, auf der der Abschnitt steht. */
  aktuellerTitel?: string;
}) {
  const zeigeStart = content.show_home !== false;
  const zeigeAktuell = content.show_current !== false;
  const verbergen = content.hide_without_parent !== false;

  // Hostaway rät ausdrücklich davon ab, Brotkrumen auf flachen Websites zu
  // zeigen. Ohne Elternseite ist die Krume einstufig und sagt nichts — dann
  // lieber nichts. Im Entwurf steht stattdessen der Grund, sonst hielte der
  // Kunde den Abschnitt für kaputt.
  if (trail.length === 0 && verbergen) {
    return (
      <AbschnittLeer
        modus={modus}
        grund={texte(modus.locale).leerBrotkrumen}
      />
    );
  }

  const stufen: Array<{ titel: string; href: string | null }> = [];
  if (zeigeStart) {
    stufen.push({ titel: texte(modus.locale).brotkrumeStart, href: "/" });
  }
  for (const t of trail) {
    stufen.push({ titel: t.title, href: t.slug ? `/${t.slug}` : null });
  }
  if (zeigeAktuell && aktuellerTitel) {
    stufen.push({ titel: aktuellerTitel, href: null });
  }
  if (stufen.length === 0) return null;

  return (
    <nav
      aria-label={texte(modus.locale).brotkrumeNavigation}
      className="mx-auto max-w-6xl px-6 py-4"
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {stufen.map((s, i) => (
          <li key={`${s.titel}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? (
              <Icon icon="ph:caret-right" aria-hidden className="size-3" />
            ) : null}
            {s.href ? (
              <a
                href={s.href}
                className="underline-offset-4 transition hover:text-foreground hover:underline"
              >
                {s.titel}
              </a>
            ) : (
              // Die letzte Stufe (und jeder Ordner) ist kein Link.
              // `aria-current="page"` sagt dem Screenreader, dass hier der
              // Weg endet.
              <span aria-current={i === stufen.length - 1 ? "page" : undefined}>
                {s.titel}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
