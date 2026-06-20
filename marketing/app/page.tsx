// Marketing-Landingpage — Startseite der eigenständigen Marketing-App.
// Layout 1:1 nach Figma (Soj052u1PbHfASB2RMsOba, Node 3-613),
// umgesetzt im NextDays-Design-System (Schwarz/Rot, Fraunces/Inter, Pill-Buttons).
import { MarketingBenefits } from "@/components/marketing/marketing-benefits";
import { MarketingChannelsBar } from "@/components/marketing/marketing-channels-bar";
import { MarketingFeatures } from "@/components/marketing/marketing-features";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingIntro } from "@/components/marketing/marketing-intro";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingStats } from "@/components/marketing/marketing-stats";
import { MarketingTestimonials } from "@/components/marketing/marketing-testimonials";
import { MarketingTrial } from "@/components/marketing/marketing-trial";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NextDays — Eine Plattform für kleine Unterkünfte",
  description:
    "Steigere deine Buchungen, vereinfache deinen Betrieb und biete unvergessliche Gästeerlebnisse – alles an einem Ort. 30 Tage kostenlos testen.",
};

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <MarketingHero />
        <MarketingChannelsBar />
        <MarketingIntro />
        <MarketingBenefits />
        <MarketingTrial />
        <MarketingFeatures />
        <MarketingTestimonials />
        <MarketingStats />
      </main>
      <MarketingFooter />
    </div>
  );
}
