// Bewerbung als Partner — IN dieser App, direkt an die API (0517/0520).
// Sponsor-Code aus dem Team-Link (?sponsor=CODE) steht sichtbar im Formular.
import { getTranslations } from "next-intl/server";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { PartnerBewerbungFormular } from "@/components/partner/partner-bewerbung-formular";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partnerBewerbung");
  return { title: t("meta.titel"), description: t("meta.beschreibung"), alternates: { canonical: "/partner/bewerben" } };
}

export default async function PartnerBewerbenSeite({ searchParams }: { searchParams: Promise<{ sponsor?: string }> }) {
  const { sponsor } = await searchParams;
  const t = await getTranslations("partnerBewerbung");
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{t("titel")}</h1>
          <p className="mt-3 text-muted-foreground">{t("text")}</p>
          <div className="mt-8">
            <PartnerBewerbungFormular sponsorVorgabe={(sponsor ?? "").slice(0, 40)} />
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
