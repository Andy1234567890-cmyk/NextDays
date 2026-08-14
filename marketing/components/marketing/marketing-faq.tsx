"use client";

// FAQ — die Fragen, die vor einem Systemwechsel wirklich gestellt werden.
//
// Referenz-UX: yoveletta.ch/funktionen, Abschnitt „Alle Yoveletta Module"
// (ausgelesen 14.08.2026). Übernommen ist die Machart, nicht die Farbwelt:
//   • Jede Frage ist ein breiter, stark gerundeter Balken
//     (48 px, unten links 12 px) mit Kennzahl, Frage und Chevron rechts.
//   • Der Chevron dreht sich beim Öffnen um 180°.
//   • Die Antwort wächst über `grid-template-rows: 0fr → 1fr` auf. Das ist der
//     Trick der Referenz und der Grund, warum die Animation ohne gemessene
//     Pixelhöhe flüssig läuft — `height: auto` ist nicht animierbar, `1fr` ist es.
//   • Geöffnet trägt der Balken die Akzentfarbe, geschlossen die helle Fläche:
//     der Zustand ist damit auch ohne den Chevron erkennbar.
//
// Die Antwort bleibt im Markup, auch wenn sie zu ist (0fr + overflow-hidden,
// kein `display: none`) — Suchmaschinen lesen sie deshalb mit. Dazu ein
// FAQPage-Schema als JSON-LD aus DENSELBEN Texten; zwei getrennte Textquellen
// wären hier der klassische Fehler, denn Schema und sichtbarer Text müssen
// übereinstimmen, sonst gilt es als irreführendes Markup.
//
// Inhalt: was in der Plattform tatsächlich gebaut ist (56 Portale über Channex,
// Einheiten je Typ, Marktplatz myBestDays, Rollen, Zahlungen, EU-Hosting).
import { useTranslations } from "next-intl";
import { useState } from "react";

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

// Kantenform der Referenz: drei weiche Ecken, unten links eine harte — dadurch
// liest der Balken als Sprechblase und nicht als Button-Leiste.
const BALKEN_FORM = "rounded-[3rem_3rem_3rem_0.75rem]";

export function MarketingFaq() {
  const t = useTranslations("faq");
  // Genau eine offene Frage: bei zwölf Einträgen wird eine Seite mit allem
  // offen unlesbar lang. Null = alles zu (Startzustand).
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
    <section id="faq" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <ul className="mt-14 flex flex-col gap-4">
          {paare.map((paar, index) => {
            const istOffen = offen === paar.key;
            const bereichId = `faq-antwort-${paar.key}`;
            return (
              <li key={paar.key}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={istOffen}
                    aria-controls={bereichId}
                    onClick={() => setOffen(istOffen ? null : paar.key)}
                    className={`flex w-full items-center gap-5 px-6 py-6 text-left transition-colors sm:gap-6 sm:px-9 sm:py-7 ${BALKEN_FORM} ${
                      istOffen
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface-accent text-foreground hover:bg-accent/15"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`font-display text-lg leading-none ${istOffen ? "text-accent-foreground/70" : "text-accent"}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-lg font-semibold tracking-tight sm:text-xl">
                      {paar.frage}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className={`size-6 shrink-0 transition-transform duration-300 ${istOffen ? "rotate-180" : ""}`}
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
      </div>
    </section>
  );
}
