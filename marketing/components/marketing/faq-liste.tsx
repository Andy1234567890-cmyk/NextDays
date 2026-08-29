"use client";

// Die Aufklapp-Liste der häufigen Fragen — EINE Quelle für alle Seiten.
//
// Herausgelöst aus `marketing-faq.tsx`, als die Kontaktseite eigene Fragen
// bekam: eine zweite Kopie derselben 90 Zeilen wäre die klassische Stelle, an
// der zwei Listen auseinanderlaufen (die eine bekommt eine Verbesserung, die
// andere nicht). Die TEXTE bleiben bei der jeweiligen Seite, die MACHART steht
// hier.
//
// Referenz-UX: yoveletta.ch/funktionen, Abschnitt „Alle Yoveletta Module"
// (ausgelesen 14.08.2026). Übernommen ist die Machart, nicht die Farbwelt:
//   • Jede Frage ist ein breiter, stark gerundeter Balken mit Kennzahl, Frage
//     und Chevron rechts.
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
import { useLocale } from "next-intl";
import { useId, useState } from "react";

import { ereignisMelden } from "@/lib/analytics";

export type FaqPaar = {
  key: string;
  frage: string;
  antwort: string;
};

// Kantenform der Referenz: drei weiche Ecken, unten links eine harte — dadurch
// liest der Balken als Sprechblase und nicht als Button-Leiste.
const BALKEN_FORM = "rounded-[3rem_3rem_3rem_0.75rem]";

export function FaqListe({ paare }: { paare: readonly FaqPaar[] }) {
  // Genau eine offene Frage: mit allem offen wird die Seite unlesbar lang.
  // Null = alles zu (Startzustand).
  const [offen, setOffen] = useState<string | null>(null);
  const locale = useLocale();
  // Eigener Präfix je Instanz — sonst tragen zwei Listen auf derselben Seite
  // dieselben `id`s und `aria-controls` zeigt auf den falschen Bereich.
  const praefix = useId();

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
    <>
      <ul className="flex flex-col gap-4">
        {paare.map((paar, index) => {
          const istOffen = offen === paar.key;
          const bereichId = `${praefix}-${paar.key}`;
          return (
            <li key={paar.key}>
              <h3>
                <button
                  type="button"
                  aria-expanded={istOffen}
                  aria-controls={bereichId}
                  onClick={() => {
                    setOffen(istOffen ? null : paar.key);
                    // Nur das AUFklappen ist die Frage, die jemanden umtreibt;
                    // das Zuklappen gehört nicht in dieselbe Zahl. Gemeldet
                    // wird `paar.key` — der Übersetzungsschlüssel. Der
                    // sichtbare Fragetext wäre dieselbe Frage in 24 Sprachen
                    // und damit 24 Werte in der Auswertung.
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
                  <p className="whitespace-pre-line px-6 pt-5 leading-relaxed text-muted-foreground sm:px-9">
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
    </>
  );
}
