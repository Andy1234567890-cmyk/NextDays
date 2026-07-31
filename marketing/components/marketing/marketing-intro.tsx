// Intro — „Willkommen bei myNextDays" (Text links, Belege rechts) plus die
// Zielgruppen-Reihe.
//
// Referenz-UX (hostaway.com): zweispaltige Erklärsektion mit linksbündigem
// Eyebrow-Heading-Block und einer Check-Liste als rechte Spalte; die
// Zielgruppen stehen als flache Pill-Reihe unter einer eigenen Überschrift.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { TYPE_ICONS } from "@/components/marketing/property-type-icons";
import { SectionHeading } from "@/components/marketing/section-kit";
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

      {/* Zielgruppen */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <SectionHeading eyebrow={t("typenEyebrow")} heading={t("reichweite")} />
          {/* Kacheln mit eigenem Piktogramm je Objekttyp. Fünf Spalten, weil
              genau zehn Typen aufgehen — in drei Spalten bliebe unten eine
              einzelne Kachel als Waise stehen. */}
          <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PROPERTY_TYPES.map((type) => {
              const TypeIcon = TYPE_ICONS[type];
              return (
                <li
                  key={type}
                  className="flex flex-col items-center gap-2.5 rounded-2xl bg-surface-warm px-3 py-5 text-center transition-colors hover:bg-surface-accent"
                >
                  <TypeIcon className="size-9 text-accent" />
                  <span className="text-sm font-medium">{t(`typen.${type}`)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
