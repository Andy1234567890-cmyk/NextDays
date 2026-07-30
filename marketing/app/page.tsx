// Marketing-Landingpage — Startseite der eigenständigen Marketing-App.
//
// Sektions-Dramaturgie und UI-Rhythmus nach Auswertung von hostaway.com
// (30.07.2026): Produkt zeigen → Kanäle belegen → Nutzen → Einordnung →
// Funktionen → Zahlen → Stimme → Formular → Abschluss-CTA. Der Farbwechsel
// hell/warm trennt die Abschnitte, flache Wellen lösen die harten Kanten auf.
// Umgesetzt im NextDays-Design-System (Schwarz/Rot, Fraunces/Inter, Pill-Buttons).
import { MarketingBenefits } from "@/components/marketing/marketing-benefits";
import { MarketingChannels } from "@/components/marketing/marketing-channels";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFeatures } from "@/components/marketing/marketing-features";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingIntegrations } from "@/components/marketing/marketing-integrations";
import { MarketingIntro } from "@/components/marketing/marketing-intro";
import { MarketingKi } from "@/components/marketing/marketing-ki";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingStats } from "@/components/marketing/marketing-stats";
import { MarketingTestimonials } from "@/components/marketing/marketing-testimonials";
import { MarketingTrial } from "@/components/marketing/marketing-trial";
import { MarketingUsecases } from "@/components/marketing/marketing-usecases";
import { SectionWave } from "@/components/marketing/section-kit";

// Titel/Beschreibung kommen aus dem Root-Layout (generateMetadata, meta.*) —
// keine zweite, sprachfeste Kopie hier.
export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <MarketingHero />
        <MarketingChannels />
        {/* Welle: löst die Kante zur warmen Nutzen-/Preis-Fläche auf. */}
        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingBenefits />
        <MarketingIntro />
        <MarketingFeatures />
        <MarketingKi />
        <MarketingIntegrations />
        <MarketingStats />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingUsecases />
        <MarketingTestimonials />
        <MarketingTrial />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
