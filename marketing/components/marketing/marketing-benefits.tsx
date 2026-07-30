// Benefits — "Mehr Buchungen. Weniger Arbeit." mit 3 Statistik-Karten
// und anschließendem Preis-CTA-Banner (Akzent-Hintergrund).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Nur Schlüssel + Icon; Zahlen und Texte kommen aus messages (benefits.*).
const BENEFITS = [
  { key: "roi", icon: "ph:trend-up" },
  { key: "zeit", icon: "ph:clock-countdown" },
  { key: "support", icon: "ph:headset" },
] as const;

export function MarketingBenefits() {
  const t = useTranslations("benefits");

  return (
    <section id="funktionen" className="bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("heading")}
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <Card key={b.key} className="flex flex-col gap-4 p-8">
              <Icon icon={b.icon} className="size-9 text-accent" />
              <div>
                <p className="font-display text-3xl font-semibold text-accent">
                  {t(`${b.key}.stat`)}
                </p>
                <p className="text-sm text-muted-foreground">{t(`${b.key}.statLabel`)}</p>
              </div>
              <h3 className="font-display text-xl font-semibold">{t(`${b.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`${b.key}.text`)}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Preis-CTA-Banner — exakt nach Figma 3-871/3-872 (Werte aus dem Design):
          Sektion bg #FFB972 → accent (rot), Karte bg #FFF5EE → heller Akzent-Ton,
          Karten-radius 4.8px, Karten-padding 24px/33px, Preis #FF6842 → accent. */}
      <div id="preise" className="bg-accent">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid items-center gap-8 rounded-md bg-card px-8 py-8 lg:grid-cols-[2fr_1fr]">
            {/* Linke Spalte: Text */}
            <div>
              <h3 className="font-display text-2xl font-semibold sm:text-3xl">
                {t("preisBanner.heading")}
              </h3>
              <p className="mt-4 text-sm text-foreground">{t("preisBanner.text")}</p>
            </div>
            {/* Rechte Spalte: Preisblock */}
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-foreground">{t("preisBanner.ab")}</p>
              <p className="whitespace-nowrap">
                <span className="font-display text-3xl font-semibold text-accent">
                  {t("preisBanner.preis")}
                </span>
                <span className="ml-1 text-base font-semibold text-foreground">
                  {t("preisBanner.proMonat")}
                </span>
              </p>
              <p className="text-sm text-foreground">{t("preisBanner.zusatz")}</p>
              <Button asChild className="mt-3">
                <Link href="#preise">{t("preisBanner.cta")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
