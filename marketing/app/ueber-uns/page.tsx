// Über uns (/ueber-uns) — wer hinter myNextDays steht.
//
// AUFBAU (aus den About-Seiten der Wettbewerber abgelesen, live am 19.08.2026:
// lodgify.com/about-us, guesty.com/about-us, mews.com/en/about — alle drei
// folgen derselben Dramaturgie):
//   1. Hero mit EINER Aussage über die Herkunft, nicht über das Produkt.
//   2. Warum es uns gibt — der Gründungsgedanke in Fließtext (Guesty).
//   3. Zahlen-Bento mit den belegbaren Größen (Lodgify „Impact").
//   4. Zeitleiste der Etappen (Guesty 2013–2026, Mews „Our story").
//   5. Die zwei Marken — hat kein Wettbewerber, brauchen aber wir.
//   6. Grundsätze (Mews „Constitution"), nur nachprüfbare.
//   7. Die Menschen (Mews), 8. Firmendaten + Kontakt, 9. Abschluss-CTA.
//
// Was bewusst FEHLT, obwohl es die Referenzen zeigen: Kundenzahlen, Reviews,
// Partner-Badges und Investorenlogos. Der Start ist der 01.09.2026 — davon
// existiert nichts, und eine geschätzte Zahl wäre eine Erfindung (Wurzel 4).
import { getTranslations } from "next-intl/server";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { UeberBento } from "@/components/ueber-uns/ueber-bento";
import { UeberHero } from "@/components/ueber-uns/ueber-hero";
import { UeberMarken } from "@/components/ueber-uns/ueber-marken";
import { UeberMenschen } from "@/components/ueber-uns/ueber-menschen";
import { UeberStory } from "@/components/ueber-uns/ueber-story";
import { UeberUnternehmen } from "@/components/ueber-uns/ueber-unternehmen";
import { UeberWerte } from "@/components/ueber-uns/ueber-werte";
import { UeberZeitleiste } from "@/components/ueber-uns/ueber-zeitleiste";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ueberUns.meta");
  return {
    title: t("titel"),
    description: t("beschreibung"),
    alternates: { canonical: "/ueber-uns" },
  };
}

export default function UeberUnsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <UeberHero />
        <UeberStory />
        {/* Welle: löst die Kante zur warmen Fläche des Bentos auf — derselbe
            Rhythmus wie auf der Startseite. */}
        <SectionWave from="text-background" to="bg-surface-warm" />
        <UeberBento />
        {/* Rückweg: die warme Fläche läuft in die helle Zeitleiste aus. */}
        <SectionWave from="text-surface-warm" to="bg-background" />
        <UeberZeitleiste />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <UeberMarken />
        <SectionWave from="text-surface-warm" to="bg-background" />
        <UeberWerte />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <UeberMenschen />
        <SectionWave from="text-surface-warm" to="bg-background" />
        <UeberUnternehmen />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
