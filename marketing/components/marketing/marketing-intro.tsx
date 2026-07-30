// Intro — "Willkommen bei myNextDays" (zweispaltig: Visual links, Text rechts)
// + globale Reichweite mit Property-Typ-Tabs und Kunden-Zitat.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Schlüssel, nicht Texte — die Namen der Objekttypen kommen aus messages
// (intro.typen.*).
const PROPERTY_TYPES = [
  "hotel",
  "bnb",
  "gaestehaus",
  "motel",
  "lodge",
  "ferienwohnung",
  "resort",
  "huette",
  "pension",
  "campingplatz",
] as const;

export function MarketingIntro() {
  const t = useTranslations("intro");

  return (
    <section className="bg-background">
      {/* Willkommens-Block */}
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div className="order-2 overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:order-1">
          <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-background p-6">
            <div className="flex h-full flex-col gap-3">
              <div className="h-6 w-1/2 rounded bg-muted" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 flex-1 rounded-lg bg-muted" />
                  <div className="h-10 w-16 rounded-lg bg-accent/40" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-5 text-muted-foreground">{t("p1")}</p>
          <p className="mt-4 text-muted-foreground">{t("p2")}</p>
          <p className="mt-4 text-muted-foreground">{t("p3")}</p>
          <Button asChild variant="default" className="mt-7">
            <Link href="#funktionen" className="gap-2">
              {t("cta")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Globale Reichweite */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-center font-display text-2xl font-semibold tracking-tight">
            {t("reichweite")}
          </p>

          <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
            {PROPERTY_TYPES.map((type, i) => (
              <li key={type}>
                <button
                  type="button"
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                    (i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted")
                  }
                >
                  {t(`typen.${type}`)}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
            <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted" />
            <figure>
              <Icon icon="ph:quotes-fill" className="size-10 text-accent/30" />
              <blockquote className="mt-4 font-display text-2xl font-medium leading-snug">
                „{t("zitat")}“
              </blockquote>
              <figcaption className="mt-5 text-sm text-muted-foreground">
                {t("zitatQuelle")}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
