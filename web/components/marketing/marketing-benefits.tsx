// Benefits — "Mehr Buchungen. Weniger Arbeit." mit 3 Statistik-Karten
// und anschließendem Preis-CTA-Banner (Akzent-Hintergrund).
//
// Der Preisblock rechts holt Einstiegspreis UND Portal-Provision aus
// `/subscriptions/public/pricing`. Vorher standen dort „39 €" im JSX und
// „+0,5 % Buchungswert" in 24 Sprachdateien — zwei Zahlen parallel zur
// Abrechnung, die bei einer Änderung stumm falsch geworden wären (Wurzel 4).
// Fehlt die Preisliste, entfällt der Preisblock; der Weg zur Preisseite bleibt.
import { Icon } from "@iconify/react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { staffelPreisCent } from "@nextdays/tarif";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import { getPublicPricing } from "@/lib/subscriptions";

const BENEFITS = [
  {
    icon: "ph:trend-up",
    stat: "63×",
    statLabel: "Return on Investment",
    title: "Mehr Buchungen gewinnen",
    text: "Erreiche die richtigen Gäste über die wichtigsten Buchungskanäle, Metasuche und deine eigene Website – für maximale Auslastung.",
  },
  {
    icon: "ph:clock-countdown",
    stat: "35 Min.",
    statLabel: "gespart pro Buchung",
    title: "Betrieb vereinfachen",
    text: "Steuere jeden Aspekt deiner Unterkunft von einem Ort aus – ob unterwegs oder am Schreibtisch.",
  },
  {
    icon: "ph:headset",
    stat: "24/7",
    statLabel: "Support",
    title: "Expertise, der du vertrauen kannst",
    text: "myNextDays gibt dir Zugang zu einem globalen Netzwerk von Experten, 24/7-Support und Sicherheit, um deine Unterkunft mit Zuversicht auszubauen.",
  },
];

export async function MarketingBenefits() {
  const t = await getTranslations("marketingSite");
  const locale = await getLocale();
  const preise = await getPublicPricing();
  const liste = preise.ok ? preise.data : null;
  const einstiegCent = liste
    ? staffelPreisCent(liste.grundtarif_tiers, 1)
    : null;
  return (
    <section id="funktionen" className="bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mehr Buchungen. Weniger Arbeit.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="flex flex-col gap-4 p-8">
              <Icon icon={b.icon} className="size-9 text-accent" />
              <div>
                <p className="font-display text-3xl font-semibold text-accent">
                  {b.stat}
                </p>
                <p className="text-sm text-muted-foreground">{b.statLabel}</p>
              </div>
              <h3 className="font-display text-xl font-semibold">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.text}</p>
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
                Alles für deine Unterkunft an einem Ort
              </h3>
              <p className="mt-4 text-sm text-foreground">
                30 Tage kostenlos. Keine Mindestlaufzeit. Jederzeit kündbar.
              </p>
            </div>
            {/* Rechte Spalte: Preisblock */}
            <div className="flex flex-col items-start gap-2">
              {liste && einstiegCent !== null && (
                <>
                  <p className="text-sm text-foreground">ab</p>
                  <p className="whitespace-nowrap">
                    <span className="font-display text-3xl font-semibold text-accent">
                      {formatCurrency(einstiegCent / 100, liste.currency, locale)}
                    </span>
                    <span className="ml-1 text-base font-semibold text-foreground">
                      pro Monat
                    </span>
                  </p>
                  <p className="text-sm text-foreground">
                    {t("bookingValue", {
                      satz: `${new Intl.NumberFormat(locale, {
                        maximumFractionDigits: 2,
                      }).format(liste.commission_external_percent)} %`,
                    })}
                  </p>
                </>
              )}
              <Button asChild className="mt-3">
                <Link href="#preise">{t("seePrices")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
