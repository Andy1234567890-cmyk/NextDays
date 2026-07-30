// Testimonials — "Was unsere zufriedenen Kunden sagen" (2 Zitat-Karten).
// Der Stats-Block ist eine eigene Sektion: marketing-stats.tsx (Figma 3-1109).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

// Schlüssel, nicht Texte — Zitat, Name und Ort kommen aus messages
// (testimonials.*).
const TESTIMONIALS = ["eins", "zwei"] as const;

export function MarketingTestimonials() {
  const t = useTranslations("testimonials");

  return (
    <section id="kunden" className="bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("heading")}
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((key) => (
            <figure
              key={key}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm"
            >
              <div className="flex text-accent">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Icon key={i} icon="ph:star-fill" className="size-4" />
                ))}
              </div>
              <blockquote className="text-muted-foreground">
                „{t(`${key}.quote`)}“
              </blockquote>
              <figcaption className="mt-auto">
                <p className="font-semibold">{t(`${key}.name`)}</p>
                <p className="text-sm text-muted-foreground">{t(`${key}.location`)}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
