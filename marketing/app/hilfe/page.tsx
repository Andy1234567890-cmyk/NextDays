// Hilfe-Center-Startseite: heller Such-Hero + illustrierte Kategorie-Karten je
// Sammlung. Inhalte in der Sprache des Nutzers (Cookie-Locale), UI aus next-intl.
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { CategoryTile } from "@/components/help/category-tile";
import { HelpSearchBox } from "@/components/help/help-search-box";
import { articleCount, categoriesByCollection, getHelpTree } from "@/content/help";
import type { HelpCollection } from "@/content/help/types";
import type { Locale } from "@/i18n/locales";

export const metadata: Metadata = {
  title: "Hilfe-Center · myNextDays",
  description:
    "Antworten und Schritt-für-Schritt-Anleitungen für das myNextDays PMS und den Kanalmanager.",
  alternates: { canonical: "/hilfe" },
};

export default async function HelpHomePage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("help");
  const categories = await getHelpTree(locale);

  const collections: { id: HelpCollection; title: string; description: string }[] = [
    { id: "kb", title: t("collectionKbTitle"), description: t("collectionKbDesc") },
    {
      id: "usecases",
      title: t("collectionUsecasesTitle"),
      description: t("collectionUsecasesDesc"),
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-accent/8 via-accent/[0.03] to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-20 size-56 rounded-full bg-accent/5 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-24">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t("heroSubtitle")}</p>
          <div className="w-full max-w-xl">
            <HelpSearchBox size="lg" />
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
        {collections.map((collection) => {
          const inCollection = categoriesByCollection(categories, collection.id);
          if (inCollection.length === 0) return null;
          return (
            <section key={collection.id} className="flex flex-col gap-8">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {collection.title}
                </h2>
                <p className="text-muted-foreground">{collection.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {inCollection.map((category) => (
                  <CategoryTile
                    key={category.slug}
                    category={category}
                    count={articleCount(category)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
