"use client";

// Alt-Text mit der KI vorschlagen, für den BILD-BAUSTEIN des Seiten-Editors
// (0463–0465, `../editor/bild-feld.tsx`, dort nur wenn `mitAltText` gesetzt
// ist — siehe dort für die Begründung).
//
// Die MEDIATHEK hat ihren eigenen Weg: `mediathek/details-leiste.tsx` zeigt
// den Alt-Text jedes Bildes dauerhaft und bietet den KI-Vorschlag direkt dort
// an — dort ist immer schon eine Zeile für den Text offen. Im Bild-Baustein
// gibt es keine solche Zeile (der Baustein trägt nur eine URL, siehe
// `bild-feld.tsx`), deshalb hier ein KOMPAKTER Knopf, der sein eigenes
// Popover mitbringt.
//
// Der Vorschlag ersetzt NICHTS von selbst: er erscheint im Popover, mit einem
// Übernehmen- und einem Verwerfen-Knopf. Übernehmen speichert sofort über
// `updateMedium` (Alt-Text gehört dem BILD, nicht dem Abschnitt) und setzt die
// Herkunft — `ai_generated`, weil hier aus nichts ein neuer Text entsteht,
// genau wie bei einem neu erzeugten Abschnitt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { updateMedium } from "@/lib/site-medien";
import { kiAltText, kiAltTextHerkunftSetzen } from "@/lib/site-ki";

import { useKi } from "./ki-context";

type Vorschlag = { text: string; warnungen: string[] };

/** Erzeugen, zeigen, übernehmen oder verwerfen. */
function useAltVorschlag(mediumId: string, sprache: string) {
  const [laedt, setLaedt] = useState(false);
  const [vorschlag, setVorschlag] = useState<Vorschlag | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function erzeugen() {
    setLaedt(true);
    setFehler(null);
    const res = await kiAltText({ medium_id: mediumId, sprache });
    setLaedt(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setVorschlag({ text: res.data.alt_text, warnungen: res.data.warnungen });
  }

  async function uebernehmen(): Promise<string | null> {
    if (!vorschlag) return null;
    const text = vorschlag.text;
    const gespeichert = await updateMedium(mediumId, { alt_text: text });
    if (!gespeichert.ok) {
      setFehler(gespeichert.error);
      return null;
    }
    // Best-effort: die Herkunft ist eine Zusatzangabe für die Nachvollziehbarkeit,
    // kein Grund, dem Kunden den gespeicherten Alt-Text wieder wegzunehmen, wenn
    // NUR dieser zweite Aufruf scheitert (Wurzel 5 — Hauptpfad nicht kippen).
    void kiAltTextHerkunftSetzen({
      medium_id: mediumId,
      herkunft: "ai_generated",
    });
    setVorschlag(null);
    return text;
  }

  function verwerfen() {
    setVorschlag(null);
    setFehler(null);
  }

  return { laedt, vorschlag, fehler, erzeugen, uebernehmen, verwerfen };
}

/** Der kompakte Weg für den Bild-Baustein: EIN Knopf am Bild, kein
 *  Dauerfeld. Erscheint nur, wenn sich die URL einem Bild der Mediathek
 *  zuordnen lässt (`mediumId` ist dann gesetzt) — bei einer fremden Adresse
 *  gibt es keine Zeile, in die ein Alt-Text geschrieben werden könnte. */
export function BildAltKnopf({
  mediumId,
  sprache,
}: {
  mediumId: string;
  sprache: string;
}) {
  const t = useTranslations("website.ki");
  const { verfuegbar } = useKi();
  const [offen, setOffen] = useState(false);
  const { laedt, vorschlag, fehler, erzeugen, uebernehmen, verwerfen } =
    useAltVorschlag(mediumId, sprache);

  if (!verfuegbar) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        title={t("altTextKnopf")}
        aria-label={t("altTextKnopf")}
        onClick={() => {
          setOffen((o) => !o);
          if (!offen && !vorschlag) void erzeugen();
        }}
        className="flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 text-[0.6875rem] text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground"
      >
        <Icon
          icon={laedt ? "svg-spinners:180-ring" : "solar:magic-stick-3-linear"}
          className="size-3.5"
        />
        {t("altTextKnopf")}
      </button>

      {offen ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-popover p-2 shadow-lg">
          {fehler ? (
            <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {fehler}
            </p>
          ) : vorschlag ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs leading-snug">{vorschlag.text}</p>
              {vorschlag.warnungen.map((w) => (
                <p key={w} className="text-[0.6875rem] text-amber-600 dark:text-amber-400">
                  {w}
                </p>
              ))}
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 flex-1 px-2 text-xs"
                  onClick={() =>
                    void uebernehmen().then((text) => {
                      if (text !== null) setOffen(false);
                    })
                  }
                >
                  {t("uebernehmen")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    verwerfen();
                    setOffen(false);
                  }}
                >
                  {t("verwerfen")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("altTextLaedt")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
