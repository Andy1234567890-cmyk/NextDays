// Marketing-Landingpage — Startseite der eigenständigen Marketing-App.
// Layout 1:1 nach Figma (Soj052u1PbHfASB2RMsOba, Node 3-613),
// umgesetzt im NextDays-Design-System (Schwarz/Rot, Fraunces/Inter, Pill-Buttons).
import { MarketingBenefits } from "@/components/marketing/marketing-benefits";
import { MarketingFeatures } from "@/components/marketing/marketing-features";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingIntro } from "@/components/marketing/marketing-intro";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingStats } from "@/components/marketing/marketing-stats";
import { MarketingTestimonials } from "@/components/marketing/marketing-testimonials";
import { MarketingTrial } from "@/components/marketing/marketing-trial";

// Titel/Beschreibung kommen aus dem Root-Layout (generateMetadata, meta.*) —
// keine zweite, sprachfeste Kopie hier.
export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        {/* Kanal-Karten liegen jetzt IM Hero (dunkle Leiste, id="kanaele"). */}
        <MarketingHero />
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
