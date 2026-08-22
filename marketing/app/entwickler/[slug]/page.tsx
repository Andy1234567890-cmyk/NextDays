// Ein Kapitel des Leitfadens je Adresse.
//
// Angemeldet wird ein Kapitel in `lib/entwickler-navigation.ts`; steht es dort
// nicht, gibt es die Adresse nicht. Diese Datei verbindet nur Slug → Komponente
// und hängt den „Nächste Seite"-Fuß an.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ApiFehler } from "@/components/entwickler/api-fehler";
import { ApiFehlercodes } from "@/components/entwickler/api-fehlercodes";
import { ApiGrenzen } from "@/components/entwickler/api-grenzen";
import { ApiHilfe } from "@/components/entwickler/api-hilfe";
import { ApiKonventionen } from "@/components/entwickler/api-konventionen";
import { ApiKonzepte } from "@/components/entwickler/api-konzepte";
import { ApiLimits } from "@/components/entwickler/api-limits";
import { ApiLokalisierung } from "@/components/entwickler/api-lokalisierung";
import { ApiSchnellstart } from "@/components/entwickler/api-schnellstart";
import { ApiWebhooks } from "@/components/entwickler/api-webhooks";
import { ApiZeit } from "@/components/entwickler/api-zeit";
import { ApiZugang } from "@/components/entwickler/api-zugang";
import { DokuToc } from "@/components/entwickler/doku-toc";
import { DokuWeiter } from "@/components/entwickler/doku-weiter";
import {
  KAPITEL_SLUGS,
  kapitelMitSlug,
  kapitelPfad,
  naechstesKapitel,
} from "@/lib/entwickler-navigation";

import type { KapitelId } from "@/lib/entwickler-navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const INHALTE: Partial<Record<KapitelId, () => ReactNode>> = {
  schnellstart: ApiSchnellstart,
  zugang: ApiZugang,
  konzepte: ApiKonzepte,
  konventionen: ApiKonventionen,
  fehler: ApiFehler,
  limits: ApiLimits,
  webhooks: ApiWebhooks,
  grenzen: ApiGrenzen,
  fehlercodes: ApiFehlercodes,
  lokalisierung: ApiLokalisierung,
  zeit: ApiZeit,
  hilfe: ApiHilfe,
};

export function generateStaticParams() {
  return KAPITEL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const kapitel = kapitelMitSlug(slug);
  if (!kapitel) return {};
  const t = await getTranslations("entwickler");
  return {
    title: `${t(`inhalt.${kapitel.labelKey}`)} — ${t("meta.titel")}`,
    alternates: { canonical: `/entwickler/${kapitel.slug}` },
  };
}

export default async function KapitelSeite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("entwickler");
  const kapitel = kapitelMitSlug(slug);
  const Inhalt = kapitel ? INHALTE[kapitel.id] : undefined;
  if (!kapitel || !Inhalt) notFound();

  const naechstes = naechstesKapitel(kapitel.id);

  // Zwei Spalten: Text und rechts das Inhaltsverzeichnis der Seite. Ohne die
  // zweite Spalte bleibt bei einer Doku-Breite rechts eine leere Hälfte stehen.
  return (
    <div className="gap-10 xl:grid xl:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0">
        <Inhalt />
        {naechstes ? (
          <DokuWeiter
            label={t("weiter.naechste")}
            titel={t(`inhalt.${naechstes.labelKey}`)}
            href={kapitelPfad(naechstes.slug)}
          />
        ) : (
          // Ende des Leitfadens: von hier führt der Weg in die Referenz.
          <DokuWeiter
            label={t("weiter.naechste")}
            titel={t("weiter.zurReferenz")}
            href="/entwickler/referenz"
          />
        )}
      </div>
      <DokuToc titel={t("sidebar.tocTitel")} />
    </div>
  );
}
