import type { ReactNode } from "react";

import type { LegalDoc } from "@/content/legal/types";

// Winziger Inline-Link-Parser: erkennt ausschließlich [Text](https://…) —
// bewusst kein Markdown-Paket, Rechtstexte brauchen nur Links.
// Grenzen (bewusst, da die Rechtstexte nur einfache Links enthalten): die URL
// darf KEINE Klammer enthalten (bricht bei der ersten `)` ab); verschachtelte
// Brackets im Link-Text matchen nicht. Beim Einpflegen neuer Links darauf achten.
const LINK_RE = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    nodes.push(
      <a
        key={`${href}-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
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

// `lang` setzt die Dokumentsprache am Artikel (das Root-<html> der Plattform ist
// fest „de", die AGB gibt es aber in 24 Sprachen) — für Screenreader und SEO.
export function LegalDocument({ doc, lang }: { doc: LegalDoc; lang?: string }) {
  return (
    <article
      lang={lang}
      className="mx-auto flex w-full max-w-3xl flex-col gap-8"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">{doc.stand}</p>
      </header>
      <div className="flex flex-col gap-4">
        {doc.intro.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {renderInline(p)}
          </p>
        ))}
      </div>
      {doc.sections.map((section, si) => (
        <section key={si} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs.map((p, pi) => (
            <p key={pi} className="text-sm leading-relaxed text-muted-foreground">
              {renderInline(p)}
            </p>
          ))}
          {section.list && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {section.list.map((item, li) => (
                <li key={li} className="text-sm leading-relaxed text-muted-foreground">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
