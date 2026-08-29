"use client";

// Preis-FAQ — die Fragen, die genau HIER gestellt werden (Laufzeit, Währung,
// Steuern, Umzug, was passiert bei mehr Objekten).
//
// Bewusst eine eigene Sektion und nicht die große FAQ der Startseite: dort
// stehen zwölf Fragen zum Produkt, hier fünf zum Geld. Die Machart ist
// dieselbe wie in `marketing-faq.tsx` (Balken mit Kennzahl, 0fr→1fr-Animation,
// Antwort bleibt im Markup) — ein zweites Bedienmuster für dasselbe Element
// wäre für den Besucher ein Bruch.
//
// Kein zweites FAQPage-Schema: die Startseite trägt es schon, und zwei
// FAQPage-Auszeichnungen auf einer Domain für unterschiedliche Fragen sind
// erlaubt — aber der sichtbare Text UND das Schema müssen übereinstimmen,
// deshalb entsteht das Schema hier aus denselben Texten.
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SectionHeading } from "@/components/marketing/section-kit";
import { ereignisMelden } from "@/lib/analytics";

const FRAGEN = [
  "laufzeit",
  "objektzahl",
  "waehrung",
  "steuern",
  "umzug",
  "kuendigung",
] as const;

const BALKEN_FORM = "rounded-[3rem_3rem_3rem_0.75rem]";

export function PreisFaq() {
  const t = useTranslations("preise.faq");
  const locale = useLocale();
  const [offen, setOffen] = useState<string | null>(null);

  const paare = FRAGEN.map((key) => ({
    key,
    frage: t(`${key}.frage`),
    antwort: t(`${key}.antwort`),
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: paare.map((paar) => ({
      "@type": "Question",
      name: paar.frage,
      acceptedAnswer: { "@type": "Answer", text: paar.antwort },
    })),
  };

  return (
    <section id="preis-faq" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <ul className="mt-14 flex flex-col gap-4">
          {paare.map((paar, index) => {
            const istOffen = offen === paar.key;
            const bereichId = `preis-faq-${paar.key}`;
            return (
              <li key={paar.key}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={istOffen}
                    aria-controls={bereichId}
                    onClick={() => {
                      setOffen(istOffen ? null : paar.key);
                      // Nur das AUFklappen zählt, und gemeldet wird der
                      // Übersetzungsschlüssel statt des sichtbaren Textes —
                      // dieselbe Begründung wie in `faq-liste.tsx`.
                      if (!istOffen) {
                        ereignisMelden(
                          "faq_geoeffnet",
                          { frage: paar.key },
                          locale,
                        );
                      }
                    }}
                    className={`flex w-full items-center gap-5 px-6 py-6 text-left transition-colors sm:gap-6 sm:px-9 sm:py-7 ${BALKEN_FORM} ${
                      istOffen
                        ? "bg-accent text-accent-foreground"
                        : "bg-card text-foreground hover:bg-accent/10"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`font-display text-lg leading-none ${
                        istOffen ? "text-accent-foreground/70" : "text-accent"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-lg font-semibold tracking-tight sm:text-xl">
                      {paar.frage}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className={`size-6 shrink-0 transition-transform duration-300 ${
                        istOffen ? "rotate-180" : ""
                      }`}
                    >
                      <path
                        d="m6 9 6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </h3>

                {/* 0fr → 1fr statt height: auto — sonst gibt es keine Animation. */}
                <div
                  id={bereichId}
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: istOffen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pt-5 leading-relaxed text-muted-foreground sm:px-9">
                      {paar.antwort}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* `<` maskieren: sonst könnte ein Text mit „</script>" das Skript
            beenden. JSON.stringify allein tut das nicht. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      </div>
    </section>
  );
}
