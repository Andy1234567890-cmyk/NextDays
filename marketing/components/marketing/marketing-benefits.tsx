// Benefits — drei Kernnutzen als Icon-Kreis-Spalten, danach der Preis-Teaser.
//
// Referenz-UX (hostaway.com): unter der Logo-Reihe drei gleichwertige Spalten,
// jede mit einem Line-Icon in einem hell getönten Kreis, darunter eine kurze,
// fette Aussage. Keine Karten-Rahmen, keine Kennzahlen-Kacheln — die Ruhe
// entsteht durch viel Weißraum und die gleiche Höhe der drei Spalten.
import { useLocale, useTranslations } from "next-intl";

import {
  IllustrationBookings,
  IllustrationEurope,
  IllustrationOperations,
} from "@/components/marketing/illustrations";
import { SectionHeading } from "@/components/marketing/section-kit";
import { PreisTeaser } from "@/components/preise/preis-teaser";

// Nur Schlüssel + Illustration; die Texte kommen aus messages (benefits.*).
// Bewusst OHNE Kennzahlen: das Produkt startet erst am 01.09.2026, es gibt
// keine messbaren ROI-/Zeitersparnis-Werte, die man behaupten könnte.
const BENEFITS = [
  { key: "buchungen", Illustration: IllustrationBookings },
  { key: "betrieb", Illustration: IllustrationOperations },
  { key: "fair", Illustration: IllustrationEurope },
] as const;

export function MarketingBenefits() {
  const t = useTranslations("benefits");
  // Die Sprache wird an den Teaser durchgegeben: er formatiert Beträge und
  // darf sie nicht in deutscher Schreibweise an 23 andere Sprachen liefern.
  const locale = useLocale();

  return (
    <>
      <section className="bg-surface-warm">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.key} className="flex flex-col items-center text-center">
                <span className="flex size-28 items-center justify-center rounded-full bg-surface-accent text-accent">
                  <b.Illustration className="size-16" />
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold">
                  {t(`${b.key}.title`)}
                </h3>
                <p className="mt-3 max-w-sm text-muted-foreground">{t(`${b.key}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preis-Teaser: eigene Komponente, weil die Beträge SERVERSEITIG aus
          der Preisliste kommen (kein Betrag in den 24 Sprachdateien) und von
          hier auf die Preisseite /preise führen. */}
      <PreisTeaser locale={locale} />
    </>
  );
}
