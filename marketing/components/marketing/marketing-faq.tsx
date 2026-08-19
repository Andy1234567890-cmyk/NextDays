"use client";

// FAQ der Startseite — die Fragen, die vor einem Systemwechsel wirklich
// gestellt werden.
//
// Die Machart (Balken, Chevron, 0fr→1fr-Animation, FAQPage-Schema) steht in
// `faq-liste.tsx` und wird mit der Kontaktseite geteilt; hier stehen nur noch
// die Fragen dieser Seite.
//
// Inhalt: was in der Plattform tatsächlich gebaut ist (56 Portale über Channex,
// Einheiten je Typ, Marktplatz myBestDays, Rollen, Zahlungen, EU-Hosting).
import { useTranslations } from "next-intl";

import { FaqListe } from "@/components/marketing/faq-liste";
import { SectionHeading } from "@/components/marketing/section-kit";

// Reihenfolge = Reihenfolge auf der Seite: erst „was ist das", dann Vertrieb,
// dann Betrieb, dann Geld, zuletzt Einstieg.
const FRAGEN = [
  "was",
  "portale",
  "sync",
  "betriebsarten",
  "direkt",
  "marktplatz",
  "zahlungen",
  "laender",
  "rollen",
  "app",
  "sicherheit",
  "preis",
] as const;

export function MarketingFaq() {
  const t = useTranslations("faq");

  const paare = FRAGEN.map((key) => ({
    key,
    frage: t(`${key}.frage`),
    antwort: t(`${key}.antwort`),
  }));

  return (
    <section id="faq" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />
        <div className="mt-14">
          <FaqListe paare={paare} />
        </div>
      </div>
    </section>
  );
}
