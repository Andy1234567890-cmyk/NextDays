// Kontakt (/kontakt) — wie man uns erreicht.
//
// AUFBAU (aus den Kontaktseiten der Wettbewerber abgelesen, live am 19.08.2026:
// lodgify.com/contact, smoobu.com/de/kontakt, mews.com/en/contact-us — alle drei
// folgen derselben Reihenfolge):
//   1. Hero mit EINER Zusage, plus Telefon und E-Mail direkt im Kopf.
//   2. Die Wege — Themenkarten VOR dem Formular (bei allen drei so).
//   3. Das Formular mit Themenwahl; die Themenwahl bestimmt das Postfach.
//   4. Anschrift und Firmendaten (Mews „So finden Sie uns").
//   5. Häufige Fragen zur Kontaktaufnahme (Lodgify).
//   6. Abschluss-CTA wie auf allen Unterseiten.
//
// Was bewusst FEHLT, obwohl die Referenzen es zeigen: Bewertungssterne
// („4,8/5" bei Lodgify), regionale Vertriebsnummern für sechs Länder und
// Antwortzeit-Versprechen. Es gibt eine Nummer, einen Sitz und noch keine
// Bewertungen — der Start ist der 01.09.2026 (Wurzel 4).
//
// WOHIN DIE NACHRICHT GEHT, entscheidet ausschließlich die API
// (`features/contact/themen.py`): allgemeine und kaufmännische Anliegen an
// info@, technische an developer@. Das Formular schickt nur ein Thema-Kürzel.
import { getTranslations } from "next-intl/server";

import { KontaktAnschrift } from "@/components/kontakt/kontakt-anschrift";
import { KontaktFaq } from "@/components/kontakt/kontakt-faq";
import { KontaktFormular } from "@/components/kontakt/kontakt-formular";
import { KontaktHero } from "@/components/kontakt/kontakt-hero";
import { KontaktWege } from "@/components/kontakt/kontakt-wege";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { ANBIETER } from "@/content/legal/anbieter";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("kontakt.meta");
  return {
    title: t("titel"),
    // Adressen und Nummer aus ANBIETER, nicht aus dem Übersetzungstext — eine
    // geänderte Adresse wäre sonst 24 Dateiänderungen.
    description: t("beschreibung", {
      info: ANBIETER.email,
      technik: ANBIETER.emailTechnik,
      telefon: ANBIETER.telefon,
    }),
    alternates: { canonical: "/kontakt" },
  };
}

export default function KontaktSeite() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <KontaktHero />
        <KontaktWege />
        {/* Rückweg: die warme Fläche der Karten läuft in die helle
            Formular-Fläche aus — derselbe Rhythmus wie auf der Startseite. */}
        <SectionWave from="text-surface-warm" to="bg-background" />
        <KontaktFormular />
        <KontaktAnschrift />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <KontaktFaq />
        <SectionWave from="text-surface-warm" to="bg-background" />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
