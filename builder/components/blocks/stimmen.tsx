// Gästestimmen-Abschnitt einer Kunden-Website (0432).
//
// Frei eingetippte Zitate — aus dem Gästebuch, aus einer E-Mail, aus der
// Presse. BEWUSST getrennt vom `reviews`-Abschnitt (0266), der echte,
// verifizierte myBestDays-Bewertungen aus der Datenbank zeigt.
//
// Der Unterschied ist keine Kleinigkeit: dort ist jede Zahl belegt, hier ist
// jedes Wort eine Behauptung des Betriebs. Beides in einen Abschnitt zu legen
// hieße, dem Gast die Unterscheidung zu nehmen — und uns die Möglichkeit, für
// die echten Bewertungen zu bürgen.
//
// Deshalb gibt es hier auch KEINE Sterne. Eine eingetippte Sternebewertung wäre
// eine Zahl ohne Grundlage; wer Sterne zeigen will, nimmt den Abschnitt mit den
// echten Bewertungen.
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

type Stimme = { quote?: unknown; author?: unknown; location?: unknown };

export function StimmenBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items) ? (content.items as Stimme[]) : [];
  // Ohne Zitat kein Eintrag: ein Kasten mit Namen und ohne Aussage ist keine
  // Stimme. Name und Ort dürfen dagegen fehlen — „ein Gast aus Hamburg" ohne
  // Namen ist eine gültige, ehrliche Angabe.
  const liste = roh
    .map((s) => ({
      zitat: pickText(s.quote, modus.locale).trim(),
      autor: typeof s.author === "string" ? s.author.trim() : "",
      ort: typeof s.location === "string" ? s.location.trim() : "",
    }))
    .filter((s) => s.zitat);

  if (liste.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerStimmen}
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="pb-10 text-center font-display text-3xl font-extrabold tracking-tight"
        >
          {headline}
        </h2>
      ) : null}
      <div
        className={
          "grid gap-6 " +
          // Bei einer einzelnen Stimme keine Spalten: sie steht mittig und groß.
          (liste.length === 1
            ? "max-w-3xl mx-auto"
            : liste.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3")
        }
      >
        {liste.map((s, i) => (
          <figure
            key={`${s.autor}-${i}`}
            className="flex flex-col justify-between rounded-2xl border border-border p-6"
          >
            {/* `blockquote` und `figcaption`: das ist die Auszeichnung, die ein
                Zitat mit Quelle im HTML hat. Ein <div> wäre für Screenreader
                ein Absatz ohne Zusammenhang. */}
            <blockquote className="whitespace-pre-line text-base leading-relaxed">
              {s.zitat}
            </blockquote>
            {s.autor || s.ort ? (
              <figcaption className="pt-4 text-sm text-muted-foreground">
                {[s.autor, s.ort].filter(Boolean).join(" · ")}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
