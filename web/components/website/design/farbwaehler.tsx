"use client";

// Farbwähler einer Rolle: ein runder Punkt, Klick klappt die Auswahl auf.
//
// Aufklappen INLINE, nicht als schwebendes Fenster. Ein absolut positioniertes
// Popover ragte aus der 14rem-Leiste heraus, wurde vom `overflow-y-auto` der
// Leiste beschnitten und verdeckte die darunterliegenden Farbrollen. Inline
// schiebt es den Inhalt nach unten — sichtbar, scrollbar, nichts verdeckt.
//
// Die Zeile zeigt nur, WAS die Farbe steuert und WELCHE es ist; der Hex-Wert ist
// eine Profi-Eingabe und steht erst im aufgeklappten Bereich.
//
// Bei zu geringem Kontrast bekommt der Punkt einen Warnring. Wir korrigieren
// nichts: die Farbe ist die Entscheidung des Kunden, wir benennen nur die Folge.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Schachbrett-Andeutung für „keine Farbe gesetzt" — ein eigener Zustand, keine
 *  erfundene Ersatzfarbe (Wurzel 4). */
const LEER_MUSTER = {
  backgroundImage:
    "linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)," +
    "linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0, 3px 3px",
} as const;

export function Farbwaehler({
  wert,
  onChange,
  label,
  hinweis,
  warnung,
  zuruecksetzenLabel,
}: {
  wert: string | null;
  onChange: (hex: string | null) => void;
  label: string;
  /** Ein Satz, WAS diese Farbe auf der Seite steuert. Ohne ihn muss der Kunde
   *  raten, was „Flächen" bedeutet. */
  hinweis?: string;
  /** Gesetzt = Kontrast-Hinweis: Warnring am Punkt, Text im offenen Bereich. */
  warnung?: string;
  zuruecksetzenLabel: string;
}) {
  const [offen, setOffen] = useState(false);
  const [rohwert, setRohwert] = useState(wert ?? "");

  // Der lokale Rohwert erlaubt halb getippte Hex-Werte („#ab"), ohne dass
  // dazwischen ein ungültiger Wert nach oben gemeldet wird.
  useEffect(() => setRohwert(wert ?? ""), [wert]);

  const gueltig = HEX_RE.test(rohwert);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          {hinweis ? (
            <span className="block truncate text-xs text-muted-foreground">
              {hinweis}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          aria-label={label}
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
          className={
            "size-5 shrink-0 rounded-full border transition " +
            (warnung
              ? "border-amber-500 ring-2 ring-amber-400/50"
              : offen
                ? "border-foreground ring-2 ring-foreground/25"
                : "border-foreground/25 hover:ring-2 hover:ring-foreground/20")
          }
          style={
            wert ? { backgroundColor: wert } : { ...LEER_MUSTER }
          }
        />
      </div>

      {offen ? (
        <div className="flex flex-col gap-2 border-y border-border bg-secondary/40 px-4 py-3">
          <input
            type="color"
            aria-label={label}
            value={gueltig ? rohwert : "#000000"}
            onChange={(e) => {
              setRohwert(e.target.value);
              onChange(e.target.value);
            }}
            className="h-8 w-full cursor-pointer rounded-(--radius) border border-border bg-transparent p-0.5"
          />
          <div className="flex items-center gap-1">
            <input
              value={rohwert}
              placeholder="#000000"
              spellCheck={false}
              aria-invalid={rohwert !== "" && !gueltig}
              onChange={(e) => {
                const v = e.target.value;
                setRohwert(v);
                // Nur einen VOLLSTÄNDIGEN Hex-Wert nach oben geben; „#ab" wäre
                // beim Speichern ein 422.
                if (v === "") onChange(null);
                else if (HEX_RE.test(v)) onChange(v);
              }}
              className="min-w-0 flex-1 rounded-(--radius) border border-border bg-background px-2 py-1 font-mono text-xs aria-invalid:border-destructive"
            />
            {wert ? (
              <button
                type="button"
                aria-label={zuruecksetzenLabel}
                title={zuruecksetzenLabel}
                onClick={() => {
                  setRohwert("");
                  onChange(null);
                }}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:x" className="size-3.5" />
              </button>
            ) : null}
          </div>
          {warnung ? (
            <p className="flex items-start gap-1.5 text-xs leading-snug text-amber-700 dark:text-amber-400">
              <Icon icon="ph:warning" className="mt-0.5 size-3.5 shrink-0" />
              {warnung}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
