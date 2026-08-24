// Rechtsseite — Inhalt liegt sprachweise unter content/legal/cookies/<locale>.ts
// und wird vom gemeinsamen LegalDocument gerendert.
//
// NUR TEXT, kein Bedienfeld. Hier stand kurzzeitig die Einwilligungs-Verwaltung
// mit Schaltern und Knöpfen; sie ist am 24.08.2026 wieder raus. Der Widerruf
// nach Art. 7 Abs. 3 DSGVO läuft über den Footer-Eintrag
// „Cookie-Einstellungen", der die Leiste erneut öffnet — das ist die übliche
// Umsetzung (Cookiebot, CookieYes, Usercentrics: dauerhafter Footer-Link oder
// Symbol, das das Banner wieder aufruft), und sie erfüllt „so einfach
// widerrufbar wie erteilt" mit demselben einen Klick. Eine Rechtsseite ist der
// Text, nicht die Bedienoberfläche.
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
      </main>
      <MarketingFooter />
    </div>
  );
}
