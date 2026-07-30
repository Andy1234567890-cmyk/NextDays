// Features — "Ein System. Ein Login. Viele Funktionen." mit Tab-Navigation
// und Vorschau-Panel. Figma: horizontale Tab-Leiste über einem Produkt-Bild.
"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

// Nur Schlüssel + Icon; Label, Titel und Text kommen aus messages (features.*).
const FEATURES = [
  { key: "calendar", icon: "ph:calendar-blank" },
  { key: "channel", icon: "ph:share-network" },
  { key: "booking", icon: "ph:globe-hemisphere-west" },
  { key: "insights", icon: "ph:chart-bar" },
  { key: "channelsPlus", icon: "ph:plugs-connected" },
  { key: "revenue", icon: "ph:trend-up" },
  { key: "guest", icon: "ph:users-three" },
  { key: "website", icon: "ph:browser" },
  { key: "payments", icon: "ph:credit-card" },
  { key: "app", icon: "ph:device-mobile-camera" },
  { key: "metasearch", icon: "ph:magnifying-glass" },
] as const;

export function MarketingFeatures() {
  const t = useTranslations("features");
  const [active, setActive] = useState<string>(FEATURES[0].key);
  const current = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("heading")}
        </h2>

        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2">
          {FEATURES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              className={
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                (active === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted")
              }
            >
              <Icon icon={f.icon} className="size-4" />
              {t(`${f.key}.label`)}
            </button>
          ))}
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl font-semibold">
              {t(`${current.key}.title`)}
            </h3>
            <p className="mt-4 text-muted-foreground">{t(`${current.key}.text`)}</p>
            <a
              href="#preise"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              {t("mehrErfahren")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </a>
          </div>
          <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted shadow-lg" />
        </div>
      </div>
    </section>
  );
}
