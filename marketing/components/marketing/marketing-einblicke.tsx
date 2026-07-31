"use client";

// „So sieht das aus" — drei echte Aufnahmen aus der laufenden Software.
//
// Bewusst NACH der Funktionsmatrix: erst was das Produkt kann, dann der Beweis,
// dass es das wirklich tut. Jede Aufnahme trägt genau eine Aussage, die der
// Screenshot selbst belegt — kein Text, der etwas behauptet, was im Bild
// nicht zu sehen ist.
import { useTranslations } from "next-intl";

import { AppAufnahme } from "@/components/marketing/app-aufnahme";
import { SectionHeading } from "@/components/marketing/section-kit";

const EINBLICKE = [
  { key: "hotel", aufnahme: "belegungsplan-hotel", alt: "aufnahmeHotel" },
  { key: "objekte", aufnahme: "objekte", alt: "aufnahmeObjekte" },
  { key: "kanaele", aufnahme: "kanaele", alt: "aufnahmeKanaele" },
] as const;

export function MarketingEinblicke() {
  const t = useTranslations("einblicke");
  const tHero = useTranslations("hero");

  return (
    <section id="einblicke" className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 flex flex-col gap-16">
          {EINBLICKE.map((einblick, index) => (
            <div
              key={einblick.key}
              className="grid items-center gap-8 lg:grid-cols-[1fr_1.35fr] lg:gap-12"
            >
              {/* Text abwechselnd links/rechts, damit die Reihe nicht als
                  Liste gleicher Kacheln liest. */}
              <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                <h3 className="font-display text-2xl font-semibold tracking-tight">
                  {t(`${einblick.key}.title`)}
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {t(`${einblick.key}.text`)}
                </p>
              </div>
              <AppAufnahme
                name={einblick.aufnahme}
                alt={tHero(einblick.alt)}
                className={index % 2 === 1 ? "lg:order-1" : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
