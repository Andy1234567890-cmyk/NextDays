// Preisseite (/preise) — eigene Unterseite, nicht mehr nur der Teaser-Block
// auf der Startseite.
//
// AUFBAU (Dramaturgie einer Preisseite: Zahl zuerst, Zweifel danach):
//   1. Hero mit der Aussage „ein Tarif, alles drin" und den Zusagen, die vor
//      dem Preis geklärt sein müssen (Testzeitraum, keine Mindestlaufzeit).
//   2. Rechner: Objektzahl einstellen, Preis rechnet live, Rechnung offen.
//   3. Provisionen — bei Vermietungssoftware die eigentliche Kostenfrage.
//   4. Zusatzmodule mit echten Beträgen.
//   5. Vergleich mit den veröffentlichten Preisen der Alternativen.
//   6. FAQ zum Geld, dann Abschluss-CTA.
//
// Die Beträge kommen SERVERSEITIG aus dem Backend (holePreisliste), damit der
// Besucher im ersten Rendern eine Zahl sieht und nicht einen Ladezustand — und
// damit die Preise nicht in 24 Sprachdateien kopiert werden müssen (Wurzel 4).
import { getTranslations } from "next-intl/server";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { PreisFaq } from "@/components/preise/preis-faq";
import { PreisModule } from "@/components/preise/preis-module";
import { PreisProvisionen } from "@/components/preise/preis-provisionen";
import { PreisInklusive, PreisRechner } from "@/components/preise/preis-rechner";
import { PreisVergleich } from "@/components/preise/preis-vergleich";
import { Icon, type IconName } from "@/components/ui/icon";
import { holePreisliste } from "@/lib/preise";

import type { Metadata } from "next";

// Eigene Metadaten: die Preisseite ist die zweitwichtigste Landeseite nach der
// Startseite und braucht ihren eigenen Titel in der Suche.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preise.meta");
  return {
    title: t("titel"),
    description: t("beschreibung"),
    alternates: { canonical: "/preise" },
  };
}

// Die Zusagen über dem Preis — was ein Besucher wissen will, BEVOR er auf eine
// Zahl schaut. Schlüssel, Texte in messages (preise.hero.*).
const ZUSAGEN: readonly { key: string; icon: IconName }[] = [
  { key: "testen", icon: "ph:hourglass-high" },
  { key: "laufzeit", icon: "ph:seal-check" },
  { key: "einrichtung", icon: "ph:handshake" },
  { key: "eu", icon: "ph:shield-check" },
];

export default async function PreisePage() {
  const t = await getTranslations("preise.hero");
  const liste = await holePreisliste();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        {/* Hero: dunkle Fläche über die volle Breite.
            Die erste Fassung war hell auf hell — Überschrift, Chips und
            Steuerung verschwammen zu einer blassen Fläche ohne Blickführung.
            Eine Preisseite braucht einen Ankerpunkt; bei der Referenz
            (lodgify.com/de/preise) ist das ein dunkler Foto-Hero mit sehr
            großer Headline. Hier: Logo-Schwarz, weiße Display-Schrift,
            Akzentrot für das entscheidende Wort — und die Preiskarte ragt aus
            der Sektion heraus in die helle Fläche darunter. */}
        <section className="relative overflow-hidden bg-primary pb-40 pt-16 text-primary-foreground">
          {/* Wasserzeichen wie im Abschluss-CTA: konzentrische Ringe des
              Logo-Motivs, sehr blass. Deckkraft als SVG-Attribut, nicht als
              Tailwind-Suffix (kompiliert in v4 unzuverlässig). */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -right-24 -top-24 hidden size-[32rem] text-primary-foreground lg:block"
          >
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              opacity="0.06"
            />
            <circle cx="100" cy="100" r="40" fill="currentColor" opacity="0.05" />
          </svg>

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                {t("headlinePre")}{" "}
                <span className="relative text-accent">
                  {t("headlineHighlight")}
                  <svg
                    aria-hidden
                    viewBox="0 0 300 20"
                    className="absolute -bottom-2 left-0 w-full text-accent"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 14 C 80 4, 220 4, 298 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-primary-foreground/70">
                {t("sub")}
              </p>

            </div>

            {/* Zusagen als Chips — BEWUSST ausserhalb des Textblocks: im
                `max-w-3xl` des Fliesstextes passten die vier Pillen nicht
                nebeneinander und die letzte rutschte allein in eine zweite
                Zeile. Auf voller Breite stehen sie als eine ruhige Reihe. */}
            <ul className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
              {ZUSAGEN.map((z) => (
                <li
                  key={z.key}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm font-medium"
                >
                  <Icon icon={z.icon} className="size-4 text-accent" />
                  {t(z.key)}
                </li>
              ))}
            </ul>

            <PreisRechner liste={liste} />
          </div>
        </section>

        <PreisInklusive />

        <PreisProvisionen liste={liste} />
        <PreisModule liste={liste} />
        <PreisVergleich liste={liste} />
        <PreisFaq />
        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
