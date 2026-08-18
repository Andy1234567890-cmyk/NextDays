// Eine Route für ALLE Rechtstexte der Plattform. Abrufbar in jeder Sprache,
// in der der jeweilige Text vorliegt (?sprache=<code>); ohne Parameter Deutsch.
// Unbekanntes Dokument, unbekannter Sprachcode ODER eine Sprache, in der dieser
// Text (noch) nicht vorliegt → 404. Bewusst kein stiller Rückfall auf Deutsch:
// ein deutscher Text unter dänischer Adresse wäre eine Falschaussage.
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal-document";
import { LegalSprachwahl } from "@/components/legal-sprachwahl";
import { KontoMenu } from "@/components/konto-menu";
import { TabLeisteMobil } from "@/components/mobil/tab-leiste-mobil";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_DOC_LOCALES, hasLegalDoc, loadLegalDoc } from "@/content/legal";
import { LEGAL_CHROME } from "@/content/legal/chrome";
import {
  LEGAL_DOCUMENT_SLUGS,
  isLegalDocumentSlug,
  type LegalDocumentSlug,
} from "@/content/legal/dokumente";
import {
  DEFAULT_LEGAL_LOCALE,
  isLegalLocale,
  type LegalLocale,
} from "@/content/legal/locales";

type Params = Promise<{ dokument: string }>;
type Search = Promise<{ sprache?: string }>;

// Alle Rechtstexte sind statisch — sie werden zur Bauzeit vorgerendert.
export function generateStaticParams() {
  return LEGAL_DOCUMENT_SLUGS.map((dokument) => ({ dokument }));
}

// Löst Dokument und Sprache auf. Ein Resolver für Page UND generateMetadata,
// damit beide dieselbe Logik nutzen.
async function aufloesen(
  params: Params,
  searchParams: Search,
): Promise<{ slug: LegalDocumentSlug; locale: LegalLocale }> {
  const { dokument } = await params;
  if (!isLegalDocumentSlug(dokument)) notFound();
  const { sprache } = await searchParams;
  const locale = sprache === undefined ? DEFAULT_LEGAL_LOCALE : sprache;
  if (!isLegalLocale(locale)) notFound();
  if (!hasLegalDoc(dokument, locale)) notFound();
  return { slug: dokument, locale };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, locale } = await aufloesen(params, searchParams);
  const doc = await loadLegalDoc(slug, locale);
  return { title: `${doc.title} — myBestDays` };
}

export default async function RechtsdokumentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, locale } = await aufloesen(params, searchParams);
  const doc = await loadLegalDoc(slug, locale);
  const chrome = LEGAL_CHROME[locale];

  return (
    <div className="tabbar-abstand flex min-h-screen flex-col">
      <SiteHeader compact zurueck="/rechtliches" kontoSlot={<KontoMenu />} />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/rechtliches?sprache=${locale}`}
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:min-h-0"
          >
            ← {chrome.zurueckZumVerzeichnis}
          </Link>
          <LegalSprachwahl
            aktuell={locale}
            beschriftung={chrome.sprachwahl}
            verfuegbar={LEGAL_DOC_LOCALES[slug]}
          />
        </div>
        <LegalDocument
          doc={doc}
          lang={locale}
          inhaltsverzeichnisTitel={chrome.inhaltsverzeichnis}
        />
      </main>
      <SiteFooter />
      <TabLeisteMobil />
    </div>
  );
}
