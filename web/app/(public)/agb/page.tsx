// Öffentliche AGB-Seite (ohne Login erreichbar). Sprache folgt dem
// nd_locale-Cookie (next-intl); der Umschalter oben rechts wechselt sie.
// Für die Stripe-Custom-Genehmigung wichtig: §-Abschnitt „Zahlungsabwicklung
// durch Stripe" mit dem Stripe Connected Account Agreement.
import Link from "next/link";
import { getLocale } from "next-intl/server";

import { LanguageToggle } from "@/components/language-toggle";
import { LegalDocument } from "@/components/legal/legal-document";
import { Logo } from "@/components/logo";
import { loadAgb } from "@/content/legal";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const locale = (await getLocale()) as Locale;
  const doc = await loadAgb(locale);
  return { title: `${doc.title} — myNextDays` };
}

export default async function AgbPage() {
  const locale = (await getLocale()) as Locale;
  const doc = await loadAgb(locale);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pt-8">
        <Link href="/" aria-label="myNextDays">
          <Logo />
        </Link>
        <LanguageToggle />
      </header>
      <main className="px-6 py-10">
        <LegalDocument doc={doc} />
      </main>
    </div>
  );
}
