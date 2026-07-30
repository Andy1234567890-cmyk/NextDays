// Integrations-Sektion — Text links, Kanal-Orbit rechts.
//
// Referenz-UX (hostaway.com, „300+ integrations to help you grow your STR
// business"): linksbündiger Textblock mit einem CTA, rechts die Umlaufbahnen
// mit den Partner-Logos. Erklärt die REICHWEITE (56 Plattformen, Zwei-Wege-Sync,
// keine Doppelbuchungen); das flache Logo-Raster direkt unter dem Hero zeigt
// dagegen nur, WELCHE großen Portale dabei sind.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { ChannelOrbit } from "@/components/marketing/channel-orbit";
import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";

export function MarketingIntegrations() {
  const t = useTranslations("integrationen");

  return (
    <section className="overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow={t("eyebrow")}
            heading={t("heading")}
            align="left"
          />
          <p className="mt-6 text-muted-foreground">{t("p1")}</p>
          <p className="mt-4 text-muted-foreground">{t("p2")}</p>
          <Button asChild variant="accent" size="lg" className="mt-8">
            <Link href="#testen">{t("cta")}</Link>
          </Button>
        </div>

        <ChannelOrbit />
      </div>
    </section>
  );
}
