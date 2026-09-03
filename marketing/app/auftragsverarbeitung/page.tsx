// Rechtsseite — Inhalt liegt sprachweise unter content/legal/avv/<locale>.ts
// und wird vom gemeinsamen LegalDocument gerendert.
//
// Bis zum 24.08.2026 stand hier ein statischer Import der deutschen Fassung.
// Die Seite zeigte dadurch in ALLEN 24 Sprachen deutschen Rechtstext unter
// übersetzter Navigation — bei einem Rechtstext die schlechteste Art Fehler,
// weil sie aussieht, als wäre sie richtig. Sprache folgt jetzt dem
// nd_locale-Cookie, wie bei den AGB.
import { getLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ladeRechtsdokument } from "@/content/legal/laden";
import type { Locale } from "@/i18n/locales";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("auftragsverarbeitung", locale);
  return {
    title: `${doc.title} — myNextDays`,
    description: doc.metaDescription,
    alternates: { canonical: "/auftragsverarbeitung" },
  };
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("auftragsverarbeitung", locale);

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
