// Kategorieseite: Kopf (Illustration + Titel + Beschreibung) + Artikelliste nach
// Sektionen. Inhalte in der Sprache des Nutzers (Cookie-Locale).
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { SectionArticleList } from "@/components/help/section-article-list";
import { articleCount, getCategory, getHelpTree } from "@/content/help";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

export async function generateStaticParams() {
  const categories = await getHelpTree(DEFAULT_LOCALE);
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const locale = (await getLocale()) as Locale;
  const category = await getCategory(locale, slug);
  if (!category) return { title: "Hilfe-Center · myNextDays" };
  return {
    title: `${category.title} · Hilfe-Center · myNextDays`,
    description: category.description,
    // Aus dem geprüften Slug der gefundenen Kategorie, nicht aus dem
    // URL-Parameter — gleiche Begründung wie beim Artikel eine Ebene tiefer.
    alternates: { canonical: `/hilfe/${category.slug}` },
  };
}

export default async function HelpCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("help");
  const category = await getCategory(locale, slug);
  if (!category) notFound();

  const count = articleCount(category);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <HelpBreadcrumbs items={[{ label: category.title }]} />

      <header className="flex items-center gap-5">
        <span className="w-28 shrink-0 overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/help/illustrations/${category.slug}.svg`}
            alt=""
            aria-hidden="true"
            className="block h-auto w-full"
          />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {category.title}
          </h1>
          <p className="text-muted-foreground">{category.description}</p>
          <p className="text-sm text-muted-foreground">{t("articles", { count })}</p>
        </div>
      </header>

      <SectionArticleList category={category} />
    </div>
  );
}
