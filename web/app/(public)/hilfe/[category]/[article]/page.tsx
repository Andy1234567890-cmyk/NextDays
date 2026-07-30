// Artikelseite: Breadcrumb, Titel, Meta, Rich-Body, Feedback, verwandte Artikel.
// Inhalte in der Sprache des Nutzers (Cookie-Locale).
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/help/article-body";
import { ArticleFeedback } from "@/components/help/article-feedback";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpIcon } from "@/components/help/help-icon";
import { RelatedArticles } from "@/components/help/related-articles";
import { flattenArticles, getArticle, getHelpTree } from "@/content/help";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

export async function generateStaticParams() {
  const categories = await getHelpTree(DEFAULT_LOCALE);
  return flattenArticles(categories).map((hit) => ({
    category: hit.category.slug,
    article: hit.article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; article: string }>;
}): Promise<Metadata> {
  const { category, article } = await params;
  const locale = (await getLocale()) as Locale;
  const hit = await getArticle(locale, category, article);
  if (!hit) return { title: "Hilfe-Center · myNextDays" };
  return {
    title: `${hit.article.title} · Hilfe-Center · myNextDays`,
    description: hit.article.excerpt,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ category: string; article: string }>;
}) {
  const { category: categorySlug, article: articleSlug } = await params;
  const locale = (await getLocale()) as Locale;
  const hit = await getArticle(locale, categorySlug, articleSlug);
  if (!hit) notFound();

  const { category, article } = hit;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <HelpBreadcrumbs
        items={[
          { label: category.title, href: `/hilfe/${category.slug}` },
          { label: article.title },
        ]}
      />

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {article.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HelpIcon icon="ph:clock" className="size-4" />
            <span>{article.updated}</span>
          </div>
        </header>

        <ArticleBody body={article.body} />
      </article>

      <ArticleFeedback />

      <RelatedArticles category={category} currentSlug={article.slug} />
    </div>
  );
}
