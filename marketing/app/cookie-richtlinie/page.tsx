// Rechtsseite — Inhalt liegt sprachweise unter content/legal/cookies/<locale>.ts
// und wird vom gemeinsamen LegalDocument gerendert.
//
// Bis zum 24.08.2026 stand hier ein statischer Import der deutschen Fassung.
// Die Seite zeigte dadurch in ALLEN 24 Sprachen deutschen Rechtstext unter
// übersetzter Navigation — bei einem Rechtstext die schlechteste Art Fehler,
// weil sie aussieht, als wäre sie richtig. Sprache folgt jetzt dem
// nd_locale-Cookie, wie bei den AGB.
import { getLocale } from "next-intl/server";

import { EinwilligungsEinstellungen } from "@/components/einwilligung/einwilligungs-einstellungen";
import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ladeRechtsdokument } from "@/content/legal/laden";
import type { Locale } from "@/i18n/locales";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("cookie-richtlinie", locale);
  return { title: `${doc.title} — myNextDays`, description: doc.metaDescription };
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("cookie-richtlinie", locale);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <LegalDocument doc={doc} />
        {/* Der Widerruf gehört auf DIESE Seite: Die Einwilligungs-Leiste
            verlinkt hierher, und ohne diesen Baustein wäre die Einwilligung
            nur erteilbar, nicht änderbar (Art. 7 Abs. 3 DSGVO). Die Texte
            kommen aus messages/<locale>.json (Namespace „einwilligung"),
            nicht aus dem Rechtsdokument — deshalb ist er hier sprachfest,
            unabhängig vom Loader oben. Anker: #einwilligung. */}
        <EinwilligungsEinstellungen />
      </main>
      <MarketingFooter />
    </div>
  );
}
