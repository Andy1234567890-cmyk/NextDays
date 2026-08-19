// Häufige Fragen ZUR KONTAKTAUFNAHME — nicht zum Produkt.
//
// Referenz-UX: lodgify.com/contact schließt mit genau so einem Block, und die
// Fragen dort sind ausnahmslos organisatorisch („Welche Nummer für meine
// Zeitzone?", „Wie erreiche ich den Support?"). Das ist richtig gedacht: wer auf
// der Kontaktseite noch zögert, sucht keinen Funktionsvergleich, sondern will
// wissen, wer antwortet und wie lange es dauert.
//
// Die Produktfragen bleiben deshalb auf der Startseite (`marketing-faq.tsx`);
// hier stehen nur Fragen zum Kontaktweg. Machart und FAQPage-Schema teilen sich
// beide über `faq-liste.tsx`.
import { useTranslations } from "next-intl";

import { FaqListe } from "@/components/marketing/faq-liste";
import { SectionHeading } from "@/components/marketing/section-kit";
import { ANBIETER } from "@/content/legal/anbieter";

const FRAGEN = [
  "wer",
  "postfach",
  "sprache",
  "dauer",
  "telefon",
  "bestaetigung",
] as const;

export function KontaktFaq() {
  const t = useTranslations("kontakt.faq");

  // Postfächer und Telefonnummer als Platzhalterwerte statt im Text: sonst
  // stünden sie in 24 Sprachdateien, und eine geänderte Nummer wäre 24
  // Änderungen mit 24 Gelegenheiten, eine zu vergessen (Wurzel 4).
  const werte = {
    info: ANBIETER.email,
    technik: ANBIETER.emailTechnik,
    telefon: ANBIETER.telefon,
  };

  const paare = FRAGEN.map((key) => ({
    key,
    frage: t(`${key}.frage`),
    antwort: t(`${key}.antwort`, werte),
  }));

  return (
    <section id="kontakt-faq" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />
        <div className="mt-14">
          <FaqListe paare={paare} />
        </div>
      </div>
    </section>
  );
}
