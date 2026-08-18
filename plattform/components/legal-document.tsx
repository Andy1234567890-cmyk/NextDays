import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

import type {
  LegalDoc,
  LegalSection,
  LegalSubsection,
} from "@/content/legal/types";

// Winziger Inline-Link-Parser: erkennt ausschließlich [Text](https://…) —
// bewusst kein Markdown-Paket, Rechtstexte brauchen nur Links.
// Grenzen (bewusst, da die Rechtstexte nur einfache Links enthalten): die URL
// darf KEINE Klammer enthalten (bricht bei der ersten `)` ab); verschachtelte
// Brackets im Link-Text matchen nicht. Beim Einpflegen neuer Links darauf achten.
const LINK_RE = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

// Interne Ziele bleiben interne Links: sonst öffnet jeder Querverweis zwischen
// zwei Rechtstexten ein neues Fenster.
const INTERNE_HOSTS = ["mybestdays.dk", "www.mybestdays.dk"];

function istIntern(href: string): boolean {
  try {
    return INTERNE_HOSTS.includes(new URL(href).hostname);
  } catch {
    return false;
  }
}

// Interner Verweis: absolute URL → Pfad, damit die gewählte Sprache über
// ?sprache= erhalten bleibt.
function internerPfad(href: string, sprache: string): string {
  const url = new URL(href);
  return `${url.pathname}?sprache=${sprache}${url.hash}`;
}

function renderInline(text: string, sprache: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const intern = istIntern(href);
    nodes.push(
      <a
        key={`${href}-${index}`}
        href={intern ? internerPfad(href, sprache) : href}
        {...(intern ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="underline underline-offset-2 hover:text-foreground"
      >
        {label}
      </a>,
    );
    last = index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Anker eines Abschnitts. Fehlt die `id` im Text, wird sie aus der Position
// abgeleitet — die Sprachfassungen tragen dieselben ids, damit ein Deep-Link
// über alle 24 Sprachen hinweg gilt.
function anker(id: string | undefined, praefix: string, index: number): string {
  return id ?? `${praefix}-${index + 1}`;
}

function Absaetze({
  texte,
  sprache,
}: {
  texte: string[] | undefined;
  sprache: string;
}) {
  if (!texte || texte.length === 0) return null;
  return (
    <>
      {texte.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          {renderInline(p, sprache)}
        </p>
      ))}
    </>
  );
}

function Liste({
  eintraege,
  sprache,
}: {
  eintraege: string[] | undefined;
  sprache: string;
}) {
  if (!eintraege || eintraege.length === 0) return null;
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {eintraege.map((item, i) => (
        <li key={i} className="text-sm leading-relaxed text-muted-foreground">
          {renderInline(item, sprache)}
        </li>
      ))}
    </ul>
  );
}

function Unterabschnitt({
  sub,
  id,
  sprache,
}: {
  sub: LegalSubsection;
  id: string;
  sprache: string;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <h3 className="text-base font-semibold">{sub.heading}</h3>
      <Absaetze texte={sub.paragraphs} sprache={sprache} />
      <Liste eintraege={sub.list} sprache={sprache} />
    </section>
  );
}

function Abschnitt({
  section,
  id,
  sprache,
}: {
  section: LegalSection;
  id: string;
  sprache: string;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-lg font-semibold">{section.heading}</h2>
      <Absaetze texte={section.paragraphs} sprache={sprache} />
      <Liste eintraege={section.list} sprache={sprache} />
      {section.subsections && (
        <div className="flex flex-col gap-6">
          {section.subsections.map((sub, i) => (
            <Unterabschnitt
              key={i}
              sub={sub}
              id={anker(sub.id, `${id}-unter`, i)}
              sprache={sprache}
            />
          ))}
        </div>
      )}
      {section.definitions && (
        <dl className="flex flex-col gap-3">
          {section.definitions.map((d, i) => (
            <div key={i} className="flex flex-col gap-1">
              <dt className="text-sm font-semibold">{d.term}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                {renderInline(d.description, sprache)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// `lang` setzt die Dokumentsprache am Artikel (das Root-<html> der Plattform ist
// fest „de", die Rechtstexte gibt es aber in 24 Sprachen) — für Screenreader
// und SEO. `inhaltsverzeichnisTitel` kommt aus LEGAL_CHROME derselben Sprache.
export function LegalDocument({
  doc,
  lang,
  inhaltsverzeichnisTitel,
}: {
  doc: LegalDoc;
  lang: string;
  inhaltsverzeichnisTitel: string;
}) {
  const abschnitte = doc.sections.map((section, i) => ({
    section,
    id: anker(section.id, "abschnitt", i),
  }));

  // Ein Inhaltsverzeichnis lohnt erst ab mehreren Abschnitten; kurze
  // Richtlinien mit drei Überschriften brauchen keins.
  const zeigeVerzeichnis = abschnitte.length > 3 || doc.summary !== undefined;

  const verzeichnisListe = (
    <ul className="flex flex-col gap-1.5">
      {abschnitte.map(({ section, id }) => (
        <li key={id} className="flex flex-col gap-1.5">
          <a
            href={`#${id}`}
            className="flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:min-h-0"
          >
            {section.heading}
          </a>
          {section.subsections && (
            <ul className="flex flex-col gap-1 pl-4">
              {section.subsections.map((sub, si) => (
                <li key={si}>
                  <a
                    href={`#${anker(sub.id, `${id}-unter`, si)}`}
                    className="flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:min-h-0"
                  >
                    {sub.heading}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );

  const verzeichnis = (
    <nav aria-label={inhaltsverzeichnisTitel}>
      {/* Mobil zugeklappt, ab sm offen. Zwei Hüllen um EINE Liste. */}
      <details className="group flex flex-col sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold">
          {inhaltsverzeichnisTitel}
          <Icon
            icon="ph:caret-down"
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-3">{verzeichnisListe}</div>
      </details>
      <div className="hidden flex-col gap-3 sm:flex">
        <h2 className="text-base font-semibold">{inhaltsverzeichnisTitel}</h2>
        {verzeichnisListe}
      </div>
    </nav>
  );

  return (
    <article
      lang={lang}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {doc.title}
        </h1>
        <p className="text-sm text-muted-foreground">{doc.stand}</p>
      </header>

      <div className="flex flex-col gap-4">
        <Absaetze texte={doc.intro} sprache={lang} />
      </div>

      {doc.summary && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5">
          <h2 className="text-base font-semibold">{doc.summary.heading}</h2>
          <Absaetze texte={doc.summary.paragraphs} sprache={lang} />
        </section>
      )}

      {zeigeVerzeichnis && verzeichnis}

      {abschnitte.map(({ section, id }) => (
        <Abschnitt key={id} section={section} id={id} sprache={lang} />
      ))}
    </article>
  );
}
