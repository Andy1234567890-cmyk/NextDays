// Frage-Antwort-Abschnitt einer Kunden-Website (0431).
//
// Zwei Aufgaben in einem Block:
//   1. Sichtbar: aufklappbare Fragen (`<details>`, kein JavaScript).
//   2. Unsichtbar: ein `FAQPage`-JSON-LD für Google.
//
// Der zweite Teil ist der Grund, warum es diesen Block gibt und nicht nur einen
// Rich-Text mit fetten Zeilen: aus einem Absatz lässt sich nicht ableiten, was
// Frage und was Antwort ist. Erst getrennte Felder erlauben die Aussage — und
// erst mit ihr zeigt Google die Fragen direkt im Suchergebnis, aufklappbar.
// Für eine Textseite ohne Preis und ohne Bewertungen ist das die einzige
// erreichbare Rich-Result-Form.
//
// `<details>`/`<summary>` und keine eigene Aufklapp-Logik: das Element bringt
// Tastaturbedienung, Screenreader-Ansage und die Browser-Suche (Strg+F findet
// auch Text in einem geschlossenen `<details>`, seit alle Browser
// `hidden=until-found` unterstützen) von sich aus mit. Jede Nachbildung mit
// `useState` verliert mindestens eines davon.
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import type { SiteBranding } from "@/lib/site-context";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

type FaqEintrag = { question?: unknown; answer?: unknown };

/** Die Einträge aus dem Content lesen — nur die mit Frage UND Antwort.
 *
 *  Ein Eintrag mit Frage ohne Antwort wird WEGGELASSEN, nicht mit leerer
 *  Antwort gerendert: sichtbar wäre er eine Zeile, die sich aufklappen lässt
 *  und nichts zeigt, und im JSON-LD wäre er ein Verstoß gegen Googles
 *  Richtlinie (jede Frage braucht eine Antwort) — was das Rich Result für die
 *  ganze Seite kostet, nicht nur für diese eine Frage. */
function eintraege(
  content: Record<string, unknown>,
  locale: string,
): { frage: string; antwort: string }[] {
  const roh = Array.isArray(content.items)
    ? (content.items as FaqEintrag[])
    : [];
  const out: { frage: string; antwort: string }[] = [];
  for (const e of roh) {
    const frage = pickText(e.question, locale).trim();
    const antwort = pickText(e.answer, locale).trim();
    if (frage && antwort) out.push({ frage, antwort });
  }
  return out;
}

export function FaqBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Für den Schalter „Fragen und Antworten" unter SEO → Strukturierte Daten.
   *  Ist er aus, wird der Abschnitt normal gerendert — nur ohne JSON-LD. */
  branding?: SiteBranding | null;
}) {
  const headline = pickText(content.headline, modus.locale);
  const liste = eintraege(content, modus.locale);

  if (liste.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerFaq}
      />
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="font-display text-3xl font-extrabold tracking-tight"
        >
          {headline}
        </h2>
      ) : null}
      <div className={headline ? "pt-8" : ""}>
        {liste.map((e, i) => (
          <details
            key={`${e.frage}-${i}`}
            className="group border-b border-border py-4"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left font-semibold">
              <span>{e.frage}</span>
              {/* Das Zeichen dreht sich beim Aufklappen. Als reines CSS am
                  `group-open`-Zustand, damit es ohne JavaScript funktioniert. */}
              <span
                aria-hidden
                className="shrink-0 pt-0.5 text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            {/* `whitespace-pre-line`: die Antwort ist reiner Text (siehe
                FaqContent im Backend), aber Zeilenumbrüche, die der Betrieb
                getippt hat, sollen erhalten bleiben. */}
            <p className="whitespace-pre-line pt-3 text-muted-foreground">
              {e.antwort}
            </p>
          </details>
        ))}
      </div>

      {/* Das JSON-LD. Es steht IN diesem Abschnitt und nicht im Layout, weil es
          nur für Seiten gilt, die wirklich Fragen zeigen — eine `FAQPage`-
          Auszeichnung auf einer Seite ohne sichtbare Fragen ist laut Googles
          Richtlinie ein Verstoß.
          Im Entwurf bleibt es weg: dort ist es wirkungslos, und der Editor
          würde es als Textknoten mitzählen. */}
      {branding?.schema_faq && !modus.aktiv ? (
        <script
          type="application/ld+json"
          // Ausschließlich eigene Felder, durch JSON.stringify geführt und
          // gegen den einen möglichen Ausbruch (`</script`) gesichert — dieselbe
          // Begründung wie in components/strukturierte-daten.tsx.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: liste.map((e) => ({
                "@type": "Question",
                name: e.frage,
                acceptedAnswer: { "@type": "Answer", text: e.antwort },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
    </section>
  );
}
