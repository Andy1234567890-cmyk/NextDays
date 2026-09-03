// Öffentliche AGB-Seite auf der Marketing-Domain.
//
// Warum sie hier liegt und nicht nur in der web-App: Der Google-OAuth-
// Zustimmungsbildschirm verlangt Startseite, Datenschutz und
// Nutzungsbedingungen als öffentlich erreichbare Links und prüft sie
// automatisiert. Startseite und Datenschutz liegen auf dieser Domain — die AGB
// lagen nur unter der Dashboard-Domain, die vor dem Start nicht öffentlich ist.
// Der Link im Zustimmungsbildschirm wäre damit ein 404 gewesen.
//
// Sprache folgt dem nd_locale-Cookie (identisch zur web-App), Inhalt kommt
// sprachweise aus content/legal/agb (Loader: content/legal/laden.ts,
// derselbe wie fuer die vier anderen Rechtsdokumente).
import { getLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ladeRechtsdokument } from "@/content/legal/laden";
import type { Locale } from "@/i18n/locales";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("agb", locale);
  return {
    title: `${doc.title} — myNextDays`,
    description: doc.metaDescription,
    alternates: { canonical: "/agb" },
  };
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const doc = await ladeRechtsdokument("agb", locale);

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
