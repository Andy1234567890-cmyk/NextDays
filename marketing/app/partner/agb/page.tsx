// Partner-AGB (Teilnahmebedingungen des Partnerprogramms) — sechstes
// Rechtsdokument über denselben Loader/Renderer wie AGB und Datenschutz.
// Entwurf: der Text selbst sagt es im ersten Absatz (Anwaltsprüfung DE/DK offen).
import { getLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ladeRechtsdokument } from "@/content/legal/laden";
import type { Locale } from "@/i18n/locales";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("partner-agb", locale);
  return {
    title: `${doc.title} — myNextDays`,
    description: doc.metaDescription,
    alternates: { canonical: "/partner/agb" },
    robots: { index: true, follow: true },
  };
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("partner-agb", locale);
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <LegalDocument doc={doc} />
      </main>
      <MarketingFooter />
    </div>
  );
}
