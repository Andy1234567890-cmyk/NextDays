"use client";

// Verwandte Artikel derselben Kategorie (ohne den aktuell geöffneten).
// Überschrift aus next-intl (Namespace "help").
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { HelpCategory } from "@/content/help/types";

export function RelatedArticles({
  category,
  currentSlug,
}: {
  category: HelpCategory;
  currentSlug: string;
}) {
  const t = useTranslations("help");
  const others = category.sections
    .flatMap((s) => s.articles)
    .filter((a) => a.slug !== currentSlug)
    .slice(0, 5);

  if (others.length === 0) return null;

  return (
    <aside className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("related", { category: category.title })}
      </h2>
      <ul className="flex flex-col gap-1">
        {others.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/hilfe/${category.slug}/${a.slug}`}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Icon
                icon="ph:arrow-right"
                className="size-4 text-accent opacity-0 transition-opacity group-hover:opacity-100"
              />
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
