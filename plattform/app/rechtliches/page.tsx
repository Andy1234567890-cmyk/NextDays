// Verzeichnis aller Rechtstexte („Rechtliche Bestimmungen"). Die Titel kommen
// aus den Dokumenten selbst in der gewählten Sprache — nicht aus einer zweiten
// Titelliste, die auseinanderlaufen könnte. Liegt ein Text in der gewählten
// Sprache noch nicht vor, steht er mit seinem deutschen Titel da, ausgezeichnet
// mit lang="de" und verlinkt auf die deutsche Fassung: sichtbar unübersetzt
// statt still falsch beschriftet.
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalSprachwahl } from "@/components/legal-sprachwahl";
import { KontoMenu } from "@/components/konto-menu";
import { TabLeisteMobil } from "@/components/mobil/tab-leiste-mobil";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { hasLegalDoc, loadLegalDoc } from "@/content/legal";
import { LEGAL_CHROME } from "@/content/legal/chrome";
import {
  LEGAL_DOCUMENT_GROUP,
  LEGAL_DOCUMENT_SLUGS,
  LEGAL_GROUPS,
  type LegalDocumentSlug,
} from "@/content/legal/dokumente";
import {
  DEFAULT_LEGAL_LOCALE,
  LEGAL_LOCALES,
  isLegalLocale,
  type LegalLocale,
} from "@/content/legal/locales";

type Search = Promise<{ sprache?: string }>;

type Eintrag = { titel: string; sprache: LegalLocale };

async function resolveLocale(searchParams: Search): Promise<LegalLocale> {
  const { sprache } = await searchParams;
  if (sprache === undefined) return DEFAULT_LEGAL_LOCALE;
  if (!isLegalLocale(sprache)) notFound();
  return sprache;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}) {
  const locale = await resolveLocale(searchParams);
  return { title: `${LEGAL_CHROME[locale].verzeichnisTitel} — myBestDays` };
}

export default async function RechtlichesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const locale = await resolveLocale(searchParams);
  const chrome = LEGAL_CHROME[locale];

  const eintraege = new Map<LegalDocumentSlug, Eintrag>(
    await Promise.all(
      LEGAL_DOCUMENT_SLUGS.map(async (slug) => {
        const sprache = hasLegalDoc(slug, locale) ? locale : DEFAULT_LEGAL_LOCALE;
        const { title } = await loadLegalDoc(slug, sprache);
        return [slug, { titel: title, sprache }] as const;
      }),
    ),
  );

  return (
    <div className="tabbar-abstand flex min-h-screen flex-col">
      {/* Schlanke Kopfzeile statt der Startseiten-Navigation: auf einer
          Rechtsseite gibt es nichts zu suchen, und die Such-Leiste ragte
          mobil aus dem Bild. */}
      <SiteHeader compact zurueck="/" kontoSlot={<KontoMenu />} />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div lang={locale} className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {chrome.verzeichnisTitel}
              </h1>
              <p className="text-sm text-muted-foreground">
                {chrome.verzeichnisIntro}
              </p>
            </div>
            <LegalSprachwahl
              aktuell={locale}
              beschriftung={chrome.sprachwahl}
              verfuegbar={LEGAL_LOCALES}
            />
          </div>

          {LEGAL_GROUPS.map((gruppe) => {
            const slugs = LEGAL_DOCUMENT_SLUGS.filter(
              (slug) => LEGAL_DOCUMENT_GROUP[slug] === gruppe,
            );
            return (
              <section key={gruppe} className="flex flex-col gap-3">
                <h2 lang={locale} className="text-base font-semibold">
                  {chrome.gruppen[gruppe]}
                </h2>
                <ul className="flex flex-col gap-1 sm:gap-2">
                  {slugs.map((slug) => {
                    const eintrag = eintraege.get(slug)!;
                    return (
                      <li key={slug}>
                        <Link
                          href={`/rechtliches/${slug}?sprache=${eintrag.sprache}`}
                          lang={eintrag.sprache}
                          className="flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:min-h-0"
                        >
                          {eintrag.titel}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
      <SiteFooter />
      <TabLeisteMobil />
    </div>
  );
}
