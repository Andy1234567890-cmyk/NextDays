"use client";

// Kategorie-Karte im Grid (Startseite): individuelle Illustration oben, darunter
// Titel, Beschreibung und Artikelanzahl. Lodgify-/Zendesk-Muster, myNextDays-Branding.
// Artikel-Label aus next-intl (Namespace "help", ICU-Plural).
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { HelpCategory } from "@/content/help/types";

export function CategoryTile({
  category,
  count,
}: {
  category: HelpCategory;
  count: number;
}) {
  const t = useTranslations("help");
  return (
    <Link
      href={`/hilfe/${category.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg"
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/help/illustrations/${category.slug}.svg`}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <h3 className="font-semibold text-foreground transition-colors group-hover:text-accent">
          {category.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {category.description}
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("articles", { count })}
        </p>
      </div>
    </Link>
  );
}
