// EINZIGER Renderer für alle Rechtsdokumente dieser App (Impressum,
// Datenschutz, Cookie-Richtlinie, Auftragsverarbeitung). Kein Dokument bringt
// eigenes Layout mit — Inhalt liegt ausschließlich in content/legal/*.
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";

import type { LegalDoc, LegalSection, LegalUnterpunkt } from "@/content/legal/types";

// Winziger Inline-Link-Parser: erkennt [Text](ziel) mit ziel = https://…,
// mailto:, tel: oder relativer Pfad. Bewusst kein Markdown-Paket —
// Rechtstexte brauchen nur Links. Die URL darf KEINE Klammer enthalten.
const LINK_RE = /\[([^\]]+)\]\(((?:https:\/\/|mailto:|tel:|\/)[^\s)]+)\)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const extern = href.startsWith("https://");
    nodes.push(
      <Link
        key={`${href}-${index}`}
        href={href}
        {...(extern ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="underline underline-offset-4 transition-colors hover:text-accent"
      >
        {label}
      </Link>,
    );
    last = index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Anker-Id aus der Überschrift. Umlaute/ß werden transliteriert, damit die
// Fragmente ASCII bleiben (teilbare Links ohne Prozent-Encoding).
function ankerId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// a), b), c) … für Unterpunkte. Über 26 Unterpunkten wird durchgezählt (aa),
// ab) …) — passiert real nicht, ist aber kein stiller Fehler.
function unterpunktMarke(index: number): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  if (index < buchstaben.length) return `${buchstaben[index]})`;
  const erster = buchstaben[Math.floor(index / buchstaben.length) - 1];
  return `${erster}${buchstaben[index % buchstaben.length]})`;
}

function Absatz({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Liste({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item) => (
        <li key={item} className="text-sm leading-relaxed text-muted-foreground">
          {renderInline(item)}
        </li>
      ))}
    </ul>
  );
}

function Unterpunkt({ punkt, marke }: { punkt: LegalUnterpunkt; marke: string }) {
  return (
    <div className="flex gap-3">
      <span className="pt-0.5 text-sm font-medium tabular-nums">{marke}</span>
      <div className="flex flex-1 flex-col gap-2">
        {punkt.titel && <p className="text-sm font-medium">{punkt.titel}</p>}
        {punkt.paragraphs?.map((absatz) => (
          <Absatz key={absatz}>{renderInline(absatz)}</Absatz>
        ))}
        {punkt.list && <Liste items={punkt.list} />}
      </div>
    </div>
  );
}

function Abschnitt({
  section,
  nummer,
}: {
  section: LegalSection;
  nummer: number | null;
}) {
  return (
    <section id={ankerId(section.heading)} className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-lg font-medium">
        {nummer !== null && <span className="tabular-nums">{nummer}. </span>}
        {section.heading}
      </h2>

      {/* Reihenfolge: erst der einleitende Text, dann der Angaben-Block —
          sonst steht ein „… ist:" unter der Liste, die es einleitet. */}
      {section.paragraphs?.map((absatz) => (
        <Absatz key={absatz}>{renderInline(absatz)}</Absatz>
      ))}

      {section.zeilen && (
        <dl className="flex flex-col gap-4 border-l-2 border-accent/40 pl-5">
          {section.zeilen.map((zeile) => (
            <div key={zeile.label} className="flex flex-col gap-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {zeile.label}
              </dt>
              <dd className="flex flex-col text-sm leading-relaxed">
                {zeile.werte.map((wert, i) =>
                  // Verlinkt wird nur der erste Wert (Mail/Telefon/URL);
                  // Folgezeilen sind Zusatzangaben wie Register oder Land.
                  i === 0 && zeile.href ? (
                    <Link
                      key={wert}
                      href={zeile.href}
                      className="w-fit underline underline-offset-4 transition-colors hover:text-accent"
                    >
                      {wert}
                    </Link>
                  ) : (
                    <span key={wert}>{wert}</span>
                  ),
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {section.list && <Liste items={section.list} />}

      {section.unterpunkte && (
        <div className="flex flex-col gap-4">
          {section.unterpunkte.map((punkt, i) => (
            <Unterpunkt
              key={punkt.titel ?? punkt.paragraphs?.[0] ?? i}
              punkt={punkt}
              marke={unterpunktMarke(i)}
            />
          ))}
        </div>
      )}

      {section.links?.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="w-fit text-sm font-medium underline underline-offset-4 transition-colors hover:text-accent"
        >
          {link.label}
        </Link>
      ))}
    </section>
  );
}

/**
 * Die Stand-Zeile in der Sprache des Besuchers.
 *
 * `standIso` gewinnt gegen `stand`: das Datum wird hier mit
 * `Intl.DateTimeFormat` geschrieben und der Satz darum kommt aus
 * `legal.stand` — damit steht in keiner der 120 Sprachdateien mehr ein Datum
 * als Text. `stand` bleibt als Rückfall, solange noch Dateien darauf zeigen;
 * ist beides leer, entfällt die Zeile, statt eine leere Fläche zu zeigen.
 */
async function StandZeile({ doc }: { doc: LegalDoc }) {
  if (doc.standIso) {
    const locale = await getLocale();
    const t = await getTranslations("legal");
    const datum = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
      // `T00:00:00Z` fixiert den Tag auf UTC — ohne das verschiebt eine
      // Zeitzone westlich von Greenwich das Datum um einen Tag zurück.
      new Date(`${doc.standIso}T00:00:00Z`),
    );
    return <p className="text-sm text-muted-foreground">{t("stand", { datum })}</p>;
  }
  if (!doc.stand) return null;
  return <p className="text-sm text-muted-foreground">{doc.stand}</p>;
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">{doc.title}</h1>
        <StandZeile doc={doc} />
      </header>

      <div className="mt-8 flex flex-col gap-4">
        {doc.intro.map((absatz) => (
          <Absatz key={absatz}>{renderInline(absatz)}</Absatz>
        ))}
      </div>

      {doc.toc && (
        <nav aria-label="Inhaltsverzeichnis" className="mt-10 border-t border-border pt-8">
          <p className="text-sm font-medium">Inhaltsverzeichnis</p>
          <ol className="mt-4 flex flex-col gap-2">
            {doc.sections.map((section, i) => (
              <li key={section.heading} className="text-sm">
                <Link
                  href={`#${ankerId(section.heading)}`}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
                >
                  {doc.numbered && <span className="tabular-nums">{i + 1}. </span>}
                  {section.heading}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-12 flex flex-col gap-10">
        {doc.sections.map((section, i) => (
          <Abschnitt
            key={section.heading}
            section={section}
            nummer={doc.numbered ? i + 1 : null}
          />
        ))}
      </div>
    </article>
  );
}
