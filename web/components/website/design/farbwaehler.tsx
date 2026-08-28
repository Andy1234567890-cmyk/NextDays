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
// Im offenen Bereich stehen drei Dinge, die Hostaway ebenfalls dort führt:
//   · die Designfarben zum Verknüpfen (Klick bindet die Rolle daran),
//   · die Pipette (nimmt eine Farbe vom Bildschirm auf),
//   · die WCAG-Prüfung gegen die vier Schwellen.
//
// Wir korrigieren nichts: die Farbe ist die Entscheidung des Kunden, wir
// benennen nur die Folge (Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import type { ThemeFarbe } from "@/lib/site-config";

import { type WcagSchluessel, wcagPruefung } from "./kontrast";

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

/** Die Pipette ist eine Browser-Funktion (EyeDropper API) und steht nicht
 *  überall zur Verfügung. Fehlt sie, wird der Knopf NICHT gezeigt — ein Knopf,
 *  der nichts tut, ist schlimmer als keiner. */
type MitPipette = {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

export type FarbwaehlerTexte = {
  zuruecksetzen: string;
  pipette: string;
  verknuepfen: string;
  verknuepfungLoesen: string;
  kontrastTitel: string;
  /** Beschriftung der vier WCAG-Schwellen. */
  wcag: Record<WcagSchluessel, string>;
};

export function Farbwaehler({
  wert,
  onChange,
  label,
  hinweis,
  warnung,
  texte,
  palette = [],
  verknuepft = null,
  onVerknuepfe,
  gegenfarbe = null,
}: {
  wert: string | null;
  onChange: (hex: string | null) => void;
  label: string;
  /** Ein Satz, WAS diese Farbe auf der Seite steuert. Ohne ihn muss der Kunde
   *  raten, was „Flächen" bedeutet. */
  hinweis?: string;
  /** Gesetzt = Kontrast-Hinweis: Warnring am Punkt, Text im offenen Bereich. */
  warnung?: string;
  texte: FarbwaehlerTexte;
  /** Die Designfarben, an die sich diese Rolle binden lässt (0446). */
  palette?: ThemeFarbe[];
  /** Kennung der aktuell verknüpften Designfarbe, sonst `null`. */
  verknuepft?: string | null;
  onVerknuepfe?: (id: string | null) => void;
  /** Farbe, gegen die der Kontrast gemessen wird (der Untergrund dieser Rolle).
   *  Fehlt sie, gibt es keine Prüfung — und keine erfundene. */
  gegenfarbe?: string | null;
}) {
  // Locale ausdrücklich: `toLocaleString()` ohne Argument liefert auf dem
  // Server und im Browser verschiedene Trennzeichen (Hydration-Fehler, B6).
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const [rohwert, setRohwert] = useState(wert ?? "");

  // Der lokale Rohwert erlaubt halb getippte Hex-Werte („#ab"), ohne dass
  // dazwischen ein ungültiger Wert nach oben gemeldet wird.
  useEffect(() => setRohwert(wert ?? ""), [wert]);

  const gueltig = HEX_RE.test(rohwert);
  const pruefung = wcagPruefung(wert, gegenfarbe);
  const gebunden = palette.find((f) => f.id === verknuepft) ?? null;

  const pipette =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as MitPipette).EyeDropper;

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
        {/* Ein kleines Kettensymbol neben dem Punkt zeigt, dass diese Rolle an
            einer Designfarbe hängt. Ohne dieses Zeichen wundert sich der Kunde,
            warum sich die Farbe „von selbst" mitändert. */}
        {gebunden ? (
          <Icon
            icon="ph:link-simple"
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        ) : null}
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
          style={wert ? { backgroundColor: wert } : { ...LEER_MUSTER }}
        />
      </div>

      {offen ? (
        <div className="flex flex-col gap-2 border-y border-border bg-secondary/40 px-4 py-3">
          {/* --- Designfarben --------------------------------------------- */}
          {palette.length && onVerknuepfe ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{texte.verknuepfen}</span>
              <div className="flex flex-wrap items-center gap-1">
                {palette.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    aria-label={f.name}
                    aria-pressed={verknuepft === f.id}
                    onClick={() => {
                      // Verknüpfen setzt den Wert SOFORT mit. Sonst zeigte die
                      // Leiste eine Bindung an, deren Wirkung erst nach dem
                      // nächsten Speichern sichtbar wird — und der Kunde hielte
                      // die Funktion für kaputt.
                      onVerknuepfe(f.id);
                      setRohwert(f.color);
                      onChange(f.color);
                    }}
                    className={
                      "size-5 rounded-full border transition " +
                      (verknuepft === f.id
                        ? "border-foreground ring-2 ring-foreground/30"
                        : "border-foreground/25 hover:ring-2 hover:ring-foreground/20")
                    }
                    style={{ backgroundColor: f.color }}
                  />
                ))}
              </div>
              {gebunden ? (
                <button
                  type="button"
                  onClick={() => onVerknuepfe(null)}
                  className="self-start text-xs text-muted-foreground underline transition hover:text-foreground"
                >
                  {texte.verknuepfungLoesen}
                </button>
              ) : null}
            </div>
          ) : null}

          <input
            type="color"
            aria-label={label}
            value={gueltig ? rohwert : "#000000"}
            onChange={(e) => {
              setRohwert(e.target.value);
              onVerknuepfe?.(null);
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
                if (v === "") {
                  onVerknuepfe?.(null);
                  onChange(null);
                } else if (HEX_RE.test(v)) {
                  // Eine Handänderung löst die Verknüpfung — dieselbe Regel,
                  // die der Server durchsetzt. Hier gespiegelt, damit die
                  // Oberfläche zwischen zwei Speichervorgängen nicht das
                  // Gegenteil behauptet.
                  onVerknuepfe?.(null);
                  onChange(v);
                }
              }}
              className="min-w-0 flex-1 rounded-(--radius) border border-border bg-background px-2 py-1 font-mono text-xs aria-invalid:border-destructive"
            />
            {pipette ? (
              <button
                type="button"
                aria-label={texte.pipette}
                title={texte.pipette}
                onClick={async () => {
                  try {
                    const { sRGBHex } = await new pipette().open();
                    if (HEX_RE.test(sRGBHex)) {
                      setRohwert(sRGBHex);
                      onVerknuepfe?.(null);
                      onChange(sRGBHex);
                    }
                  } catch {
                    // Abgebrochen (Escape) — kein Fehler, nichts zu melden.
                  }
                }}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:eyedropper" className="size-3.5" />
              </button>
            ) : null}
            {wert ? (
              <button
                type="button"
                aria-label={texte.zuruecksetzen}
                title={texte.zuruecksetzen}
                onClick={() => {
                  setRohwert("");
                  onVerknuepfe?.(null);
                  onChange(null);
                }}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:x" className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* --- WCAG-Prüfung --------------------------------------------- */}
          {pruefung ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">
                {texte.kontrastTitel} · {pruefung.verhaeltnis.toLocaleString(locale)}:1
              </span>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {pruefung.punkte.map((p) => (
                  <li
                    key={p.schluessel}
                    className={
                      "flex items-center gap-1 text-xs " +
                      (p.bestanden
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground")
                    }
                  >
                    <Icon
                      icon={p.bestanden ? "ph:check" : "ph:x"}
                      className="size-3 shrink-0"
                    />
                    <span className="truncate">{texte.wcag[p.schluessel]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
