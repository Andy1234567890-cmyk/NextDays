"use client";

// Häufige Fragen (Lodgify-Muster, 02.09.2026): große, weich gerundete Karten
// mit Pfeil-Knopf; offen = Pfeil zeigt nach unten. Der sichtbare Text und das
// FAQPage-Schema entstehen aus denselben Übersetzungen (Muster preis-faq, 0431).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SectionHeading } from "@/components/marketing/section-kit";

const FRAGEN = ["wer", "wann", "wieviel", "team", "doppelt", "auszahlung", "verfolgen", "steuern", "werbung", "material"] as const;

export function PartnerFaq() {
  const t = useTranslations("partner.faq");
  const [offen, setOffen] = useState<string | null>(FRAGEN[0]);
  const paare = FRAGEN.map((f) => ({ id: f, frage: t(`${f}.frage`), antwort: t(`${f}.antwort`) }));
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: paare.map((p) => ({
      "@type": "Question",
      name: p.frage,
      acceptedAnswer: { "@type": "Answer", text: p.antwort },
    })),
  };

  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} />
        <div className="mt-12 space-y-4">
          {paare.map((p) => {
            const istOffen = offen === p.id;
            return (
              <div key={p.id} className="rounded-3xl bg-surface-warm px-6 py-5 sm:px-8">
                <button
                  type="button"
                  aria-expanded={istOffen}
                  aria-controls={`faq-${p.id}`}
                  onClick={() => setOffen(istOffen ? null : p.id)}
                  className="flex w-full items-center justify-between gap-6 text-left"
                >
                  <span className="text-lg font-semibold">{p.frage}</span>
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Icon icon={istOffen ? "ph:arrow-down" : "ph:arrow-right"} className="size-5" />
                  </span>
                </button>
                <div id={`faq-${p.id}`} hidden={!istOffen} className="mt-3 max-w-3xl text-muted-foreground">
                  {p.antwort}
                </div>
              </div>
            );
          })}
        </div>
        {/* `<` maskieren: sonst könnte ein Text mit „</script>" das Skript beenden. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      </div>
    </section>
  );
}
