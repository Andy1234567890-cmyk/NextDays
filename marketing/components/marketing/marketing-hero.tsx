// Hero — heller, zweispaltiger Einstieg: links die Botschaft, rechts das
// Produkt.
//
// Referenz-UX (hostaway.com, ausgewertet 30.07.2026): kein dunkler
// Vollbild-Hero, sondern eine helle Fläche mit linksbündigem Textblock
// (Eyebrow → Headline → Unterzeile → Trust-Zeile → zwei Vollton-CTAs) und
// dem Produkt als geschichtete Teilansichten rechts. Der Besucher sieht in
// der ersten Sekunde, WAS die Software ist — nicht nur einen Claim.
// Übernommen ist die Anordnung; Farben, Pill-Buttons und Fraunces bleiben
// myNextDays.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { ProductMockup } from "@/components/marketing/product-mockup";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/app-url";

// Trust-Streifen unter der Unterzeile — Schlüssel, nicht Texte (hero.trust*).
const TRUST = ["trustNeu", "trustVermieter", "trustAirsmil", "trustEu"] as const;

export function MarketingHero() {
  const t = useTranslations("hero");

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-surface-warm to-background">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:py-28">
        {/* Links: Botschaft */}
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {t("headlinePre")}{" "}
            <span className="relative text-accent">
              {t("headlineHighlight")}
              <svg
                aria-hidden
                viewBox="0 0 300 20"
                className="absolute -bottom-2 left-0 w-full text-accent"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 14 C 80 4, 220 4, 298 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            ,<br />
            {t("headlinePost")}
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t("subline")}
          </p>

          {/* Trust-Streifen — belegbare Aussagen statt Bewertungssterne: das
              Produkt startet erst am 01.09.2026, es gibt noch keine Reviews. */}
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
            {TRUST.map((key) => (
              <li
                key={key}
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Icon icon="ph:check-circle-fill" className="size-4 text-accent" />
                {t(key)}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" variant="accent" className="min-w-48 text-base">
              <Link href={SIGNUP_URL}>{t("ctaTrial")}</Link>
            </Button>
            <Button asChild size="lg" variant="default" className="min-w-40 text-base">
              <Link href="#demo" className="gap-2">
                <Icon icon="ph:play-circle" className="size-5" />
                {t("ctaDemo")}
              </Link>
            </Button>
          </div>
        </div>

        {/* Rechts: Produkt */}
        <div className="pb-12 lg:pb-0">
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
