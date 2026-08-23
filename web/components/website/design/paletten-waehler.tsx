"use client";

// Palettenwahl: eine Pille mit den vier Farbpunkten des aktuellen Satzes, Klick
// klappt die Liste der fertigen Paletten darunter auf.
//
// Der wichtigste Einzelknopf im ganzen Baukasten: EIN Klick setzt alle vier
// Rollen auf Werte, die zusammenpassen und deren Kontrast trägt. Wer will,
// ändert danach einzelne Rollen — die Freiheit bleibt, der Zwang fällt.
//
// Aufklappen INLINE, nicht als schwebendes Fenster: ein absolut positioniertes
// Popover ragte aus der 14rem-Leiste heraus und wurde von deren `overflow-y-auto`
// beschnitten.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { PALETTEN, type Palette } from "./farb-paletten";

/** Schachbrett-Andeutung für „keine Farbe gesetzt" — ein eigener Zustand, keine
 *  erfundene Ersatzfarbe (Wurzel 4). */
const LEER_MUSTER = {
  backgroundImage:
    "linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)," +
    "linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0, 3px 3px",
} as const;

export function PalettenWaehler({
  aktuell,
  onWaehle,
  label,
  empfohlenLabel,
  benenne,
}: {
  /** Die vier aktuell gesetzten Farben (für die Vorschau in der Pille). */
  aktuell: Array<string | null>;
  onWaehle: (p: Palette) => void;
  label: string;
  empfohlenLabel: string;
  /** Palette → übersetzter Name. */
  benenne: (p: Palette) => string;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <div className="px-4">
        <button
          type="button"
          aria-label={label}
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
          className={
            "flex w-full items-center justify-between gap-2 rounded-(--radius) border px-2 py-1.5 transition " +
            (offen ? "border-foreground" : "border-border hover:border-foreground")
          }
        >
          <span className="flex items-center gap-1">
            {aktuell.map((c, i) => (
              <span
                key={i}
                className="size-4 rounded-full border border-foreground/25"
                style={c ? { backgroundColor: c } : { ...LEER_MUSTER }}
              />
            ))}
          </span>
          <Icon
            icon={offen ? "ph:caret-up" : "ph:caret-down"}
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </div>

      {offen ? (
        <div className="mt-2 border-y border-border bg-secondary/40 py-2">
          <p className="px-4 pb-1 text-xs font-semibold text-muted-foreground">
            {empfohlenLabel}
          </p>
          <ul className="flex flex-col">
            {PALETTEN.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onWaehle(p);
                    setOffen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition hover:bg-background"
                >
                  <span className="flex shrink-0 items-center gap-1">
                    {/* Index als Key, nicht die Farbe: eine Palette darf zwei
                        Rollen mit demselben Wert haben (bei „Schlicht" sind
                        Markenfarbe und Schriftfarbe dasselbe Schwarz). */}
                    {[p.primaer, p.hintergrund, p.schrift, p.flaeche].map(
                      (c, i) => (
                        <span
                          key={i}
                          className="size-4 rounded-full border border-foreground/25"
                          style={{ backgroundColor: c }}
                        />
                      ),
                    )}
                  </span>
                  <span className="min-w-0 truncate text-xs">{benenne(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
