// Suchergebnisseite: Volltextsuche über alle Hilfe-Artikel in der Sprache des Nutzers.
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpIcon } from "@/components/help/help-icon";
import { HelpSearchBox } from "@/components/help/help-search-box";
import { searchArticles } from "@/content/help";
import type { Locale } from "@/i18n/locales";

export const metadata: Metadata = {
  title: "Suche · Hilfe-Center · myNextDays",
};

export default async function HelpSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("help");
  const results = query ? await searchArticles(locale, query) : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <HelpBreadcrumbs items={[{ label: t("searchTitle") }]} />

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t("searchTitle")}
        </h1>
        <HelpSearchBox autoFocus size="lg" defaultValue={query} />
      </div>

      {query && (
        <p className="text-sm text-muted-foreground">
          {t("results", { count: results.length, query })}
        </p>
      )}

      {query && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <HelpIcon icon="ph:magnifying-glass" className="size-8 text-muted-foreground" />
          <p className="font-medium text-foreground">{t("noResultsTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("noResultsHintPre")}
            <Link href="/hilfe" className="text-accent underline underline-offset-2">
              {t("noResultsHintLink")}
            </Link>
            .
          </p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {results.map(({ category, article }) => (
            <li key={`${category.slug}/${article.slug}`}>
              <Link
                href={`/hilfe/${category.slug}/${article.slug}`}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <HelpIcon icon="ph:file-text" className="mt-0.5 size-5 shrink-0 text-accent" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium text-foreground group-hover:text-accent">
                    {article.title}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {article.excerpt}
                  </span>
                  <span className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {category.title}
                  </span>
                </span>
                <HelpIcon
                  icon="ph:caret-right"
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
