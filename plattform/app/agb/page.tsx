// Gast-AGB der myNextDays-Plattform. EU-weit abrufbar in allen 24
// Amtssprachen über ?sprache=<code>; ohne Parameter Deutsch. Unbekannte
// Sprachcodes führen bewusst zu 404 (kein stiller Fallback).
import { notFound } from "next/navigation";

import { AgbSprachwahl } from "@/components/agb-sprachwahl";
import { LegalDocument } from "@/components/legal-document";
import { PlattformNav } from "@/components/plattform-nav";
import { SiteFooter } from "@/components/site-footer";
import { loadAgb } from "@/content/legal";
import {
  DEFAULT_LEGAL_LOCALE,
  isLegalLocale,
  type LegalLocale,
} from "@/content/legal/locales";

// Löst die Sprache aus dem Query-Parameter auf: ohne Parameter Deutsch,
// unbekannter Code → 404 (kein stiller Fallback). Ein Resolver für Page UND
// generateMetadata, damit beide dieselbe Logik nutzen.
async function resolveLocale(
  searchParams: Promise<{ sprache?: string }>,
): Promise<LegalLocale> {
  const { sprache } = await searchParams;
  if (sprache === undefined) return DEFAULT_LEGAL_LOCALE;
  if (!isLegalLocale(sprache)) notFound();
  return sprache;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ sprache?: string }>;
}) {
  const locale = await resolveLocale(searchParams);
  const doc = await loadAgb(locale);
  return { title: `${doc.title} — myNextDays` };
}

export default async function AgbPage({
  searchParams,
}: {
  searchParams: Promise<{ sprache?: string }>;
}) {
  const locale = await resolveLocale(searchParams);
  const doc = await loadAgb(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <PlattformNav />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto flex w-full max-w-3xl justify-end pb-6">
          <AgbSprachwahl aktuell={locale} />
        </div>
        <LegalDocument doc={doc} lang={locale} />
      </main>
      <SiteFooter />
    </div>
  );
}
