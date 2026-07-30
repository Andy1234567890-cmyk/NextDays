// Features — „Ein System. Ein Login." als Tab-Leiste über einem Panel, beides
// in EINEM umrandeten Rahmen.
//
// Referenz-UX (hostaway.com): der Funktionsüberblick liegt dort in einem
// einzigen großen weißen Rahmen (1px Rand, 16px Radius) statt in vielen
// Einzelkarten — das ruhigste Layout für viele Einträge. Übernommen: der
// Rahmen, die Icon-Kreise, der Ghost-Button am Fuß. Die Tab-Interaktion
// bleibt, weil wir 14 Funktionen mit echtem Erklärtext haben.
"use client";

import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";

// Nur Schlüssel + Icon; Label, Titel und Text kommen aus messages (features.*).
// `bald` = zum Launch (01.09.2026) noch nicht aktiv → als „In Kürze" markiert,
// damit die Seite keine Funktion als verfügbar verkauft, die es nicht gibt.
const FEATURES = [
  { key: "calendar", icon: "ph:calendar-blank", bald: false },
  { key: "channel", icon: "ph:share-network", bald: false },
  { key: "booking", icon: "ph:globe-hemisphere-west", bald: false },
  { key: "insights", icon: "ph:chart-bar", bald: false },
  { key: "channelsPlus", icon: "ph:plugs-connected", bald: false },
  { key: "revenue", icon: "ph:trend-up", bald: false },
  { key: "guest", icon: "ph:users-three", bald: false },
  { key: "website", icon: "ph:browser", bald: false },
  { key: "payments", icon: "ph:credit-card", bald: false },
  { key: "app", icon: "ph:device-mobile-camera", bald: false },
  { key: "owner", icon: "ph:key", bald: false },
  { key: "cleaning", icon: "ph:broom", bald: false },
  { key: "voice", icon: "ph:microphone", bald: false },
  { key: "metasearch", icon: "ph:magnifying-glass", bald: true },
] as const;

export function MarketingFeatures() {
  const t = useTranslations("features");
  const [active, setActive] = useState<string>(FEATURES[0].key);
  const current = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  return (
    <section id="funktionen" className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          {/* Tab-Raster — 14 Einträge in festen Spalten (7 × 2 auf großen
              Schirmen). Die frühere umbrechende Pill-Reihe ließ je nach Breite
              ein bis zwei Waisen in der letzten Zeile stehen und wirkte
              unsortiert; ein Raster hält gleiche Kachelgrößen und Zeilen. */}
          <div className="grid grid-cols-2 gap-2 border-b border-border bg-surface-warm p-4 sm:grid-cols-4 sm:gap-3 sm:p-6 lg:grid-cols-7">
            {FEATURES.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActive(f.key)}
                aria-pressed={active === f.key}
                className={
                  "flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center transition-colors " +
                  (active === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-surface-accent")
                }
              >
                <Icon icon={f.icon} className="size-6" />
                <span className="text-xs font-medium leading-tight">
                  {t(`${f.key}.label`)}
                </span>
                {f.bald ? (
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[0.625rem] font-medium leading-4 " +
                      (active === f.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-surface-accent text-accent")
                    }
                  >
                    {t("baldBadge")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="grid items-center gap-12 p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <span className="flex size-14 items-center justify-center rounded-full bg-surface-accent text-accent">
                <Icon icon={current.icon} className="size-7" />
              </span>
              <h3 className="mt-6 flex flex-wrap items-center gap-3 font-display text-2xl font-semibold">
                {t(`${current.key}.title`)}
                {current.bald ? (
                  <span className="rounded-full bg-surface-accent px-3 py-1 text-xs font-medium text-accent">
                    {t("baldBadge")}
                  </span>
                ) : null}
              </h3>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {t(`${current.key}.text`)}
              </p>
              <Link
                href="#preise"
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
              >
                {t("mehrErfahren")}
                <Icon icon="ph:arrow-right" className="size-4" />
              </Link>
            </div>
            {/* Neutrales Oberflächen-Wireframe statt einer leeren Farbfläche.
                Sobald echte Screenshots je Funktion vorliegen, wird das hier
                durch ein <Image> pro Feature-Schlüssel ersetzt. */}
            <div className="overflow-hidden rounded-2xl border border-border bg-surface-warm p-5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-accent" />
                <span className="size-2.5 rounded-full bg-muted" />
                <span className="size-2.5 rounded-full bg-muted" />
                <div className="ml-2 h-2.5 w-24 rounded-full bg-muted" />
              </div>
              <div className="mt-5 grid grid-cols-[1fr_2.2fr] gap-4">
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={
                        "h-6 rounded-lg " + (i === 0 ? "bg-surface-accent" : "bg-card")
                      }
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="h-14 rounded-xl bg-card" />
                  <div className="grid grid-cols-3 gap-2.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 rounded-xl bg-card" />
                    ))}
                  </div>
                  <div className="h-20 rounded-xl bg-card" />
                </div>
              </div>
            </div>
          </div>

          {/* Add-on-Abgrenzung: was im Grundpreis steckt und was Zusatzmodul ist. */}
          <p className="border-t border-border bg-surface-warm px-8 py-5 text-sm text-muted-foreground lg:px-12">
            {t("hinweis")}
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href="#testen" className="gap-2">
              {t("alleAnsehen")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
