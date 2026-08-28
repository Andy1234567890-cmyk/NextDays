"use client";

// Der KI-Knopf an einem Textfeld des Baukastens (0463–0465).
//
// Er sitzt neben der Feldbeschriftung, nicht im Fließtext: das Feld gehört dem
// Kunden, die Maschine ist ein Werkzeug daneben. Duda löst das genauso — der
// Assistent erscheint zur markierten Stelle und ersetzt sie auf Zuruf.
//
// WAS DIESER KNOPF TUT UND WAS NICHT
//
// Er bietet die FÜNF assistierenden Bearbeitungen an: Kürzen, Verlängern, Ton
// ändern, Rechtschreibung, Übersetzen. Alle fünf tragen `ai_rewritten` und
// lösen KEINE Kennzeichnung aus (EU AI Act, Erwägungsgrund 133 — assistierende
// Bearbeitung verändert die Eingabedaten nicht wesentlich). Deshalb steht hier
// nur ein DEZENTER HINWEIS und kein Banner.
//
// Das Neu-Erzeugen eines Abschnitts ist etwas anderes und sitzt woanders
// (`ki-erzeugen.tsx`): es trägt `ai_generated`, wird gekennzeichnet und muss
// vor der Veröffentlichung freigegeben werden.
//
// ERSCHEINT DER KNOPF ÜBERHAUPT?
//
// Nur wenn `status.verfuegbar` ist — also wenn der Betreiber die Anbindung
// eingerichtet hat. Ohne Konfiguration gibt es keinen Knopf, der beim Klicken
// einen Fehler wirft, sondern gar keinen Knopf.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";

import { type UmschreibArt, kiUmschreiben } from "@/lib/site-ki";

/** Die fünf Bearbeitungen in der Reihenfolge, in der sie gebraucht werden.
 *  Rechtschreibung steht bewusst nicht oben: sie ist die harmloseste und
 *  zugleich die, die man am seltensten sucht. */
const ARTEN: { art: UmschreibArt; icon: string }[] = [
  { art: "kuerzen", icon: "solar:minimize-square-linear" },
  { art: "verlaengern", icon: "solar:maximize-square-linear" },
  { art: "ton", icon: "solar:pallete-2-linear" },
  { art: "rechtschreibung", icon: "solar:spellcheck-linear" },
  { art: "uebersetzen", icon: "solar:global-linear" },
];

export function KiTextknopf({
  wert,
  sprache,
  sprachen,
  onErsetzen,
}: {
  /** Der aktuelle Feldinhalt. Ist er leer, gibt es nichts zu bearbeiten — der
   *  Knopf ist dann aus. Das ist der Unterschied zum Neu-Erzeugen. */
  wert: string;
  /** Sprache der aktuell bearbeiteten Fassung. Wird an den Server gereicht und
   *  dort ausdrücklich in die Anweisung geschrieben — nicht geraten. */
  sprache: string;
  /** Sprachen, die auf dieser Seite vorkommen. Zielauswahl fürs Übersetzen.
   *  KEINE erfundene Liste: es sind die Fassungen, die es wirklich gibt. */
  sprachen: string[];
  onErsetzen: (neu: string) => void;
}) {
  const t = useTranslations("website.ki");
  const [offen, setOffen] = useState(false);
  const [laeuft, setLaeuft] = useState<UmschreibArt | null>(null);
  const [ton, setTon] = useState("");
  const [zielsprache, setZielsprache] = useState(
    sprachen.find((s) => s !== sprache) ?? "en",
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [warnungen, setWarnungen] = useState<string[]>([]);

  const leer = !wert.trim();

  async function ausfuehren(art: UmschreibArt) {
    setFehler(null);
    setWarnungen([]);
    setLaeuft(art);
    const res = await kiUmschreiben({
      text: wert,
      art,
      sprache,
      ...(art === "ton" ? { ton } : {}),
      ...(art === "uebersetzen" ? { zielsprache } : {}),
    });
    setLaeuft(null);
    if (!res.ok) {
      // Die Fehlermeldung des Servers wird GEZEIGT, nicht durch eine eigene
      // ersetzt: sie unterscheidet „Tageslimit erreicht (12 von 200)" von
      // „Dienst nicht erreichbar", und beides verlangt etwas anderes vom
      // Betrieb.
      setFehler(res.error);
      return;
    }
    // Warnungen sind KEIN Grund, den Text zu verwerfen — aber sie werden
    // angezeigt. Ein bei der Token-Grenze abgeschnittener Text sieht fertig
    // aus, und ein verbotenes Wort fällt beim Überfliegen nicht auf.
    setWarnungen(res.data.warnungen);
    onErsetzen(res.data.text);
    if (res.data.warnungen.length === 0) setOffen(false);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={leer}
        title={leer ? t("knopfLeer") : t("knopf")}
        onClick={() => setOffen((o) => !o)}
        className="h-6 gap-1 rounded-full px-2 text-xs"
      >
        <Icon icon="solar:magic-stick-3-linear" className="size-3.5" />
        {t("knopf")}
      </Button>

      {offen && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-border bg-popover p-2 shadow-lg">
          <div className="flex flex-col gap-0.5">
            {ARTEN.map(({ art, icon }) => (
              <div key={art}>
                <button
                  type="button"
                  disabled={laeuft !== null}
                  onClick={() => {
                    // „Ton" und „Übersetzen" brauchen eine Zusatzangabe. Sie
                    // hier abzufragen ist nicht Bequemlichkeit: der Server
                    // weist einen Aufruf ohne sie ab (Wurzel 4 — kein
                    // erfundener Ersatzwert wie „freundlicher" oder „Englisch").
                    if (art === "ton" && !ton.trim()) return;
                    void ausfuehren(art);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                >
                  <Icon
                    icon={laeuft === art ? "svg-spinners:180-ring" : icon}
                    className="size-3.5 shrink-0"
                  />
                  {t(`art.${art}`)}
                </button>
                {art === "ton" && (
                  <Input
                    value={ton}
                    onChange={(e) => setTon(e.target.value)}
                    placeholder={t("tonPlatzhalter")}
                    className="mb-1 ml-7 h-7 w-[calc(100%-1.75rem)] text-xs"
                  />
                )}
                {art === "uebersetzen" && sprachen.length > 1 && (
                  <NativeSelect
                    value={zielsprache}
                    onChange={(e) => setZielsprache(e.target.value)}
                    className="mb-1 ml-7 h-7 w-[calc(100%-1.75rem)] text-xs"
                  >
                    {sprachen
                      .filter((s) => s !== sprache)
                      .map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                  </NativeSelect>
                )}
              </div>
            ))}
          </div>

          {fehler && (
            <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {fehler}
            </p>
          )}
          {warnungen.map((w) => (
            <p
              key={w}
              className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400"
            >
              {w}
            </p>
          ))}

          {/* Der dezente Hinweis. KEIN Banner und keine Kennzeichnung: eine
              Bearbeitung des eigenen Textes ist assistierende Bearbeitung und
              nicht kennzeichnungspflichtig. Der Satz steht trotzdem da, weil
              der Betrieb wissen soll, dass hier eine Maschine mitgeschrieben
              hat — und weil er den Text danach lesen soll. */}
          <p className="mt-2 border-t border-border pt-2 text-[0.7rem] leading-snug text-muted-foreground">
            {t("hinweisUmschreiben")}
          </p>
        </div>
      )}
    </div>
  );
}
