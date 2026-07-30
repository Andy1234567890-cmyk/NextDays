// Locale-fähige Registry & Such-Helfer des Hilfe-Centers. Inhalte liegen pro
// Sprache als eigenes Modul (content/help/<locale>/index.ts) mit identischer
// Struktur (gleiche slugs/icons/collection) — nur Texte übersetzt. Sprachen ohne
// eigenes Modul fallen automatisch auf Deutsch zurück (wie bei den Rechtstexten).
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

import type { HelpArticle, HelpCategory, HelpCollection, HelpSection } from "./types";

// Lazy-Loader je Sprache. Bewusst ohne Eintrag für noch nicht übersetzte
// Sprachen — getHelpTree fällt dann auf Deutsch zurück.
const LOADERS: Partial<Record<Locale, () => Promise<{ categories: HelpCategory[] }>>> = {
  bg: () => import("./bg"),
  cs: () => import("./cs"),
  da: () => import("./da"),
  de: () => import("./de"),
  el: () => import("./el"),
  en: () => import("./en"),
  es: () => import("./es"),
  et: () => import("./et"),
  fi: () => import("./fi"),
  fr: () => import("./fr"),
  ga: () => import("./ga"),
  hr: () => import("./hr"),
  hu: () => import("./hu"),
  it: () => import("./it"),
  lt: () => import("./lt"),
  lv: () => import("./lv"),
  mt: () => import("./mt"),
  nl: () => import("./nl"),
  pl: () => import("./pl"),
  pt: () => import("./pt"),
  ro: () => import("./ro"),
  sk: () => import("./sk"),
  sl: () => import("./sl"),
  sv: () => import("./sv"),
};

export type ArticleHit = {
  category: HelpCategory;
  section: HelpSection;
  article: HelpArticle;
};

export async function getHelpTree(locale: Locale): Promise<HelpCategory[]> {
  const load = LOADERS[locale] ?? LOADERS[DEFAULT_LOCALE]!;
  const mod = await load();
  return mod.categories;
}

export function categoriesByCollection(
  categories: HelpCategory[],
  collection: HelpCollection,
): HelpCategory[] {
  return categories.filter((c) => c.collection === collection);
}

export function findCategory(
  categories: HelpCategory[],
  slug: string,
): HelpCategory | undefined {
  return categories.find((c) => c.slug === slug);
}

export function articleCount(category: HelpCategory): number {
  return category.sections.reduce((n, s) => n + s.articles.length, 0);
}

export async function getCategory(
  locale: Locale,
  slug: string,
): Promise<HelpCategory | undefined> {
  return findCategory(await getHelpTree(locale), slug);
}

export async function getArticle(
  locale: Locale,
  categorySlug: string,
  articleSlug: string,
): Promise<ArticleHit | undefined> {
  const category = await getCategory(locale, categorySlug);
  if (!category) return undefined;
  for (const section of category.sections) {
    const article = section.articles.find((a) => a.slug === articleSlug);
    if (article) return { category, section, article };
  }
  return undefined;
}

export function flattenArticles(categories: HelpCategory[]): ArticleHit[] {
  const out: ArticleHit[] = [];
  for (const category of categories) {
    for (const section of category.sections) {
      for (const article of section.articles) {
        out.push({ category, section, article });
      }
    }
  }
  return out;
}

function bodyText(article: HelpArticle): string {
  return article.body
    .map((b) => (b.type === "ul" || b.type === "steps" ? b.items.join(" ") : b.text))
    .join(" ");
}

// Gewichtete Volltextsuche (Titel > Auszug > Body) über die Sprache des Nutzers.
export async function searchArticles(locale: Locale, query: string): Promise<ArticleHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored: { hit: ArticleHit; score: number }[] = [];
  for (const hit of flattenArticles(await getHelpTree(locale))) {
    const title = hit.article.title.toLowerCase();
    const excerpt = hit.article.excerpt.toLowerCase();
    const body = bodyText(hit.article).toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 8;
      if (excerpt.includes(term)) score += 3;
      if (body.includes(term)) score += 1;
    }
    if (score > 0) scored.push({ hit, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.hit);
}
