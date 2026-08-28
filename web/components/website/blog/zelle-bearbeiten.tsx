"use client";

// DIE ZELLE IST DAS EINGABEFELD (0481).
//
// Der zentrale Befund der Framer-Analyse, Abschnitt B8a und G:
//
//     „Einfachklick wählt, Doppelklick macht die Zelle zum `<input>`. Der
//      Dialog ist der zweite Weg, nicht der einzige. Wer nur einen Dialog
//      baut, baut die halbe Tabelle."
//
// Bis hierher öffnete JEDER Klick auf eine Zeile den Dialog. Einen Autornamen
// zu korrigieren waren damit vier Handgriffe (Zeile klicken · Feld suchen ·
// tippen · speichern) statt zwei (doppelklicken · tippen).
//
// DREI ZUSTÄNDE, NICHT ZWEI
// =========================
// ruhend → ausgewählt (Einfachklick) → in Bearbeitung (Doppelklick).
// Der mittlere ist nicht Zierde: er ist die Rückmeldung, dass der Klick
// angekommen ist, und er trägt die Tastatur-Bedienung (Enter öffnet die
// Bearbeitung, ohne dass man doppelklicken muss).
//
// Gemessene Werte des Vorbilds (E1/F): Fokus-Hintergrund `rgb(242,250,255)`,
// blauer Rahmen, Text wechselt von `#999` auf `#222`. Die Hex-Werte übernehmen
// wir NICHT — das ist Framers Palette. Wir nehmen unsere Token (`--brand`,
// `--secondary`), sonst stünde hier eine zwölfte Farbe ohne Dunkelmodus.
import { useEffect, useRef, useState } from "react";

import { cn } from "@nextdays/ui/utils";

/** Was beim Verlassen der Bearbeitung passiert. */
export type ZellAbschluss = "speichern" | "verwerfen";

export function ZelleBearbeiten({
  wert,
  mehrzeilig,
  maxZeichen,
  ausgewaehlt,
  bearbeitet,
  platzhalter,
  ariaLabel,
  onAuswaehlen,
  onBearbeiten,
  onFertig,
}: {
  /** Der aktuelle Wert. Leer = die Zelle zeigt den Platzhalter grau. */
  wert: string;
  mehrzeilig: boolean;
  /** `null` = keine Grenze. Kommt aus der Feldkonfiguration (0481). */
  maxZeichen: number | null;
  ausgewaehlt: boolean;
  bearbeitet: boolean;
  platzhalter: string;
  ariaLabel: string;
  onAuswaehlen: () => void;
  onBearbeiten: () => void;
  /** `wert` ist der neue Text; bei `verwerfen` unverändert. */
  onFertig: (abschluss: ZellAbschluss, wert: string) => void;
}) {
  const [entwurf, setEntwurf] = useState(wert);
  const feld = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Beim Öffnen den aktuellen Wert übernehmen und markieren. Ohne das
  // Zurücksetzen trüge die Zelle beim zweiten Öffnen noch den Entwurf des
  // ersten — auch den verworfenen.
  useEffect(() => {
    if (!bearbeitet) return undefined;
    setEntwurf(wert);
    // Nach dem Rendern fokussieren: vorher gibt es das Feld noch nicht.
    const t = setTimeout(() => {
      feld.current?.focus();
      feld.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [bearbeitet, wert]);

  if (bearbeitet) {
    const gemeinsam = {
      value: entwurf,
      "aria-label": ariaLabel,
      maxLength: maxZeichen ?? undefined,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setEntwurf(e.target.value),
      // Der Klick INS Feld darf die Zeile nicht öffnen.
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
      // Verlassen speichert. Das ist die Erwartung an eine Tabellenzelle —
      // ein Dialog fragt, eine Zelle übernimmt.
      onBlur: () => onFertig("speichern", entwurf),
      className: cn(
        "w-full rounded-sm border border-(--brand) bg-background px-2 py-1",
        "text-sm text-foreground outline-none",
      ),
    };

    const aufTaste = (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      // Escape VERWIRFT. Nicht speichern: wer abbricht, will den alten Wert
      // zurück — und in einer Tabelle ist das der einzige Weg dorthin.
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onFertig("verwerfen", wert);
        return;
      }
      // Enter speichert. Im mehrzeiligen Feld nur MIT Modifikator, sonst
      // könnte man dort keinen Absatz setzen.
      if (e.key === "Enter" && (!mehrzeilig || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        onFertig("speichern", entwurf);
      }
    };

    return mehrzeilig ? (
      <textarea
        {...gemeinsam}
        ref={feld as React.RefObject<HTMLTextAreaElement>}
        rows={3}
        onKeyDown={aufTaste}
      />
    ) : (
      <input
        {...gemeinsam}
        ref={feld as React.RefObject<HTMLInputElement>}
        type="text"
        onKeyDown={aufTaste}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        // Die Zeile NICHT öffnen — der Einfachklick wählt nur die Zelle.
        // Genau das ist der Unterschied, den Abschnitt B8a beschreibt.
        e.stopPropagation();
        onAuswaehlen();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onBearbeiten();
      }}
      onKeyDown={(e) => {
        // Mit der Tastatur ist Enter das, was der Doppelklick mit der Maus
        // ist. Ohne diese Zeile wäre die Inline-Bearbeitung ausschließlich
        // per Maus erreichbar.
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          onBearbeiten();
        }
      }}
      className={cn(
        "w-full truncate rounded-sm px-2 py-1 text-left text-sm transition-colors",
        ausgewaehlt
          ? "bg-(--brand)/10 text-foreground ring-2 ring-(--brand)"
          : "text-foreground/70 hover:bg-secondary/40",
      )}
    >
      {wert || (
        <span className="text-muted-foreground/60">{platzhalter}</span>
      )}
    </button>
  );
}
