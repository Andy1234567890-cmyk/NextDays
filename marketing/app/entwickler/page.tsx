// Entwickler-Dokumentation (/entwickler) — die öffentliche API von myNextDays.
//
// AUFBAU (aus den Dev-Portalen der Wettbewerber abgelesen, live am 21.08.2026:
// docs.lodgify.com und api.hostaway.com/documentation):
//   1. Kopf mit Basis-Adresse, Version und dem Weg ins Schema.
//   2. Schnellstart — Zugang, Token, erster Aufruf, mit fertigen Befehlen.
//   3. Konzepte — das Datenmodell und die drei Regeln (Währung, Zeit, Kanäle).
//   4. Konventionen — Blättern, Fehler, Rate-Limits, Idempotenz.
//   5. Endpunkte je Bereich mit Scopes, plus Verweis auf die OpenAPI-Datei.
//   6. Webhooks samt Signaturprüfung.
//   7. Grenzen von v1 — was die API nicht kann und warum.
//   8. Hilfe und Versionierungs-Zusagen.
//
// Was von den Referenzen NICHT übernommen wurde:
//   · Eine zweite, handgepflegte Endpunkt-Referenz. Lodgify pflegt sie in
//     ReadMe.io neben der Implementierung; wir verweisen auf die OpenAPI-Datei,
//     die aus dem Code entsteht und deshalb nicht veralten kann.
//   · Ein Login-Zwang. Lodgify verlangt für „Try it" eine Anmeldung; unsere
//     Konsole liegt offen auf api.mynextdays.dk/docs.
//   · Kunden-Logos und Marketing-Blöcke. Wer hier landet, will anfangen.
//
// Warum die technischen Inhalte NICHT in den 24 Sprachdateien stehen: siehe den
// Kopf von `content/api/referenz.ts`. Übersetzt sind die Erklärungen, nicht der
// Vertrag.
import { getTranslations } from "next-intl/server";

import { ApiEndpunkte } from "@/components/entwickler/api-endpunkte";
import { ApiGrenzen } from "@/components/entwickler/api-grenzen";
import { ApiHero } from "@/components/entwickler/api-hero";
import { ApiHilfe } from "@/components/entwickler/api-hilfe";
import { ApiInhalt } from "@/components/entwickler/api-inhalt";
import { ApiKonventionen } from "@/components/entwickler/api-konventionen";
import { ApiKonzepte } from "@/components/entwickler/api-konzepte";
import { ApiSchnellstart } from "@/components/entwickler/api-schnellstart";
import { ApiWebhooks } from "@/components/entwickler/api-webhooks";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("entwickler.meta");
  return {
    title: t("titel"),
    description: t("beschreibung"),
    alternates: { canonical: "/entwickler" },
  };
}

export default function EntwicklerPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      {/* Kein SectionWave zwischen den Abschnitten: die Wellen der Startseite
          sind Marketing-Rhythmus. Eine Doku-Seite wird gescrollt und gesucht,
          und jede dekorative Kante kostet dabei Höhe. */}
      <ApiHero />
      <ApiInhalt />
      <main className="flex-1">
        <ApiSchnellstart />
        <ApiKonzepte />
        <ApiKonventionen />
        <ApiEndpunkte />
        <ApiWebhooks />
        <ApiGrenzen />
        <ApiHilfe />
      </main>
      <MarketingFooter />
    </div>
  );
}
