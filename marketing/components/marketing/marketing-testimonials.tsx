// Gründerin-Zitat — bewusst KEINE Kundenstimmen und keine Bewertungssterne:
// das Produkt startet erst am 01.09.2026, es gibt noch keine Kunden, deren
// Zitate man zeigen könnte. Sobald echte Stimmen vorliegen, wird hier auf eine
// Mehr-Karten-Ansicht (Karussell wie bei Hostaway) zurückgebaut.
//
// Referenz-UX (hostaway.com): Zitat-Sektion auf warmem Grund, Eyebrow über der
// Überschrift, das Zitat in einer weißen Karte mit dünnem Rand.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { SectionHeading } from "@/components/marketing/section-kit";

export function MarketingTestimonials() {
  const t = useTranslations("testimonials");

  return (
    <section id="kunden" className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} />

        {/* Foto links, Zitat rechts: das echte Bild der Gründerin trägt die
            Aussage — es ist die einzige Person, die auf dieser Seite spricht. */}
        <figure className="mx-auto mt-12 grid max-w-5xl items-stretch gap-0 overflow-hidden rounded-3xl bg-card shadow-float-lg md:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="relative aspect-[4/3] w-full md:aspect-auto md:min-h-[22rem]">
            <Image
              src="/marketing/team/jeanine-aagaard.png"
              alt={t("gruenderin.name")}
              fill
              loading="eager"
              sizes="(min-width: 768px) 18rem, 100vw"
              className="object-cover object-top"
            />
          </div>

          <div className="flex flex-col justify-center gap-5 p-10 sm:p-12">
            <Icon icon="ph:quotes-fill" className="size-10 text-accent/30" />
            <blockquote className="font-display text-2xl font-medium leading-snug">
              „{t("gruenderin.quote")}“
            </blockquote>
            <figcaption>
              <span className="block font-semibold">{t("gruenderin.name")}</span>
              <span className="block text-sm text-muted-foreground">
                {t("gruenderin.location")}
              </span>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
