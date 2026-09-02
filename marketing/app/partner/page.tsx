// Partnerprogramm (/partner) — die Programmseite für Influencer, Berater,
// Agenturen und Vermieter mit Netzwerk (Affiliate-Programm, 0517).
//
// AUFBAU (aus den Programmseiten der Wettbewerber abgelesen, 02.09.2026:
// hostaway.com/affiliate-program, lodgify.com/affiliates, uplisting.io/refer-a-host):
//   1. Hero mit der Zusage (Satz, Dauer) und zwei Knöpfen (Bewerben, Login).
//   2. Drei Schritte — bewerben, teilen, verdienen.
//   3. Die Staffel als Vergleichstabelle (Lodgify-Muster, 02.09.2026): Ränge als
//      Pills, Provision UND Team-Provision (0520), Leistungen mit Haken — LIVE
//      aus der API (`/affiliates/tiers`), der Satz steht an EINER Stelle (Wurzel 4).
//   3b. „Team aufbauen" und das dunkle Band „Schon Kunde?".
//   4. Die Regeln — Basis, Dauer, Auszahlung, Kennzeichnung, Verbote, Daten.
//   5. FAQ, dann Abschluss-CTA.
//
// Was bewusst FEHLT: Verdienstrechner mit erfundenen Beispielbeträgen und
// Testimonials von Partnern — es gibt noch keine (Wurzel 4).
import { getTranslations } from "next-intl/server";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { PartnerAbschluss } from "@/components/partner/partner-abschluss";
import { PartnerBedingungen } from "@/components/partner/partner-bedingungen";
import { PartnerFaq } from "@/components/partner/partner-faq";
import { PartnerHero } from "@/components/partner/partner-hero";
import { PartnerSchritte } from "@/components/partner/partner-schritte";
import { PartnerKundeCta } from "@/components/partner/partner-kunde-cta";
import { PartnerTeam } from "@/components/partner/partner-team";
import { PartnerVergleich } from "@/components/partner/partner-vergleich";
import { holeStaffel, maxSatzProzent } from "@/lib/partner";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partner.meta");
  const staffel = await holeStaffel();
  return {
    title: t("titel"),
    description: t("beschreibung", { max: maxSatzProzent(staffel) }),
    alternates: { canonical: "/partner" },
  };
}

export default async function PartnerSeite() {
  const staffel = await holeStaffel();
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <PartnerHero max={maxSatzProzent(staffel)} />
        <PartnerSchritte />
        <SectionWave from="text-surface-warm" to="bg-background" />
        <PartnerVergleich staffel={staffel} />
        <PartnerTeam staffel={staffel} />
        <PartnerKundeCta />
        <PartnerBedingungen />
        <PartnerFaq />
        <PartnerAbschluss />
      </main>
      <MarketingFooter />
    </div>
  );
}
