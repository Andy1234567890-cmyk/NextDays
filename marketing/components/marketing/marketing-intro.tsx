// Intro — „Willkommen bei myNextDays" (Text links, Belege rechts).
//
// Referenz-UX (hostaway.com): zweispaltige Erklärsektion mit linksbündigem
// Eyebrow-Heading-Block und einer Check-Liste als rechte Spalte.
//
// Die Zielgruppen standen bis 14.08.2026 hier als flache Kachelreihe und sind
// jetzt eine eigene Sektion mit gestapelten Karten:
// components/marketing/marketing-zielgruppen.tsx.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";

// Belegbare Aussagen statt Kundenzitat — Texte aus messages (intro.belege.*).
const BELEGE = ["neu", "eu", "kanaele", "start"] as const;

export function MarketingIntro() {
  const t = useTranslations("intro");

  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl items-start gap-16 px-6 py-24 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow={t("eyebrow")}
            heading={t("heading")}
            align="left"
          />
          <p className="mt-6 text-muted-foreground">{t("p1")}</p>
          <p className="mt-4 text-muted-foreground">{t("p2")}</p>
          <p className="mt-4 text-muted-foreground">{t("p3")}</p>
          <Button asChild variant="default" className="mt-8">
            <Link href="#funktionen" className="gap-2">
              {t("cta")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-border bg-surface-warm p-8 shadow-card sm:p-10">
          <h3 className="font-display text-xl font-semibold">{t("belegeHeading")}</h3>
          <ul className="mt-6 flex flex-col gap-5">
            {BELEGE.map((key) => (
              <li key={key} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-accent text-accent">
                  <Icon icon="ph:check-bold" className="size-4" />
                </span>
                <span className="text-muted-foreground">{t(`belege.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
