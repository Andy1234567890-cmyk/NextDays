"use client";

// Artikelliste einer Kategorie, gruppiert nach Sektionen (Zeilen-Layout wie die
// Lodgify-Sektionsseite: Icon + Titel + Auszug + Chevron).
import { Icon } from "@iconify/react";
import Link from "next/link";

import type { HelpCategory } from "@/content/help/types";

export function SectionArticleList({ category }: { category: HelpCategory }) {
  return (
    <div className="flex flex-col gap-10">
      {category.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {section.heading}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {section.articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/hilfe/${category.slug}/${article.slug}`}
                  className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <Icon
                    icon="ph:file-text"
                    className="mt-0.5 size-5 shrink-0 text-accent"
                  />
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium text-foreground group-hover:text-accent">
                      {article.title}
                    </span>
                    <span className="line-clamp-1 text-sm text-muted-foreground">
                      {article.excerpt}
                    </span>
                  </span>
                  <Icon
                    icon="ph:caret-right"
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
