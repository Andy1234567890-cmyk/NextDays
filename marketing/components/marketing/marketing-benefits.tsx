// Benefits — drei Kernnutzen als Icon-Kreis-Spalten, danach der Preis-Teaser.
//
// Referenz-UX (hostaway.com): unter der Logo-Reihe drei gleichwertige Spalten,
// jede mit einem Line-Icon in einem hell getönten Kreis, darunter eine kurze,
// fette Aussage. Keine Karten-Rahmen, keine Kennzahlen-Kacheln — die Ruhe
// entsteht durch viel Weißraum und die gleiche Höhe der drei Spalten.
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  IllustrationBookings,
  IllustrationEurope,
  IllustrationOperations,
} from "@/components/marketing/illustrations";
import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";

// Nur Schlüssel + Illustration; die Texte kommen aus messages (benefits.*).
// Bewusst OHNE Kennzahlen: das Produkt startet erst am 01.09.2026, es gibt
// keine messbaren ROI-/Zeitersparnis-Werte, die man behaupten könnte.
const BENEFITS = [
  { key: "buchungen", Illustration: IllustrationBookings },
  { key: "betrieb", Illustration: IllustrationOperations },
  { key: "fair", Illustration: IllustrationEurope },
] as const;

export function MarketingBenefits() {
  const t = useTranslations("benefits");

  return (
    <>
      <section className="bg-surface-warm">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.key} className="flex flex-col items-center text-center">
                <span className="flex size-28 items-center justify-center rounded-full bg-surface-accent text-accent">
                  <b.Illustration className="size-16" />
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold">
                  {t(`${b.key}.title`)}
                </h3>
                <p className="mt-3 max-w-sm text-muted-foreground">{t(`${b.key}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preis-Teaser — eine Karte auf warmem Grund, Preis rechts als
          eigenständiger Block (Referenz: Hostaways Preis-/CTA-Bänder liegen
          immer als abgesetzte Karte in der Sektionsfläche, nicht randlos). */}
      <section id="preise" className="bg-surface-warm pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-10 rounded-3xl border border-border bg-card px-8 py-10 shadow-soft lg:grid-cols-[1.6fr_1fr] lg:px-12">
            <div>
              <p className="eyebrow">{t("preisBanner.eyebrow")}</p>
              <h3 className="mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl">
                {t("preisBanner.heading")}
              </h3>
              <p className="mt-4 text-muted-foreground">{t("preisBanner.text")}</p>
            </div>

            <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface-accent p-6">
              <p className="whitespace-nowrap">
                <span className="font-display text-4xl font-semibold text-accent">
                  {t("preisBanner.preis")}
                </span>
                <span className="ml-1.5 text-base font-semibold">
                  {t("preisBanner.proMonat")}
                </span>
              </p>
              <p className="text-sm font-medium">{t("preisBanner.tarif")}</p>
              <p className="text-sm text-muted-foreground">{t("preisBanner.objekte")}</p>
              <p className="text-sm text-muted-foreground">{t("preisBanner.provision")}</p>
              <Button asChild variant="accent" className="mt-4 w-full">
                <Link href="#testen">{t("preisBanner.cta")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
