"use client";

// Einmalcode-Feld (6 Ziffern) für alle 2FA-Wege: TOTP-Einrichtung, SMS-Code und
// den zweiten Login-Schritt. EINE Komponente, damit Tastatur-, Paste- und
// Screenreader-Verhalten überall gleich ist statt je Formular neu erfunden.
//
// Umgesetzte Recherche-Punkte:
//   - `inputMode="numeric"` statt `type="number"` (keine Spinner, kein „e"/„+")
//   - `autoComplete="one-time-code"` → iOS/Android bieten den SMS-Code an
//   - Paste verteilt einen kopierten Code auf alle Felder (auch mit Leerzeichen)
//   - Auto-Advance vorwärts, Backspace springt rückwärts
//   - Fehler in einer `role="alert"`-Region, die IMMER im DOM steht — sonst
//     verschluckt der Screenreader die erste Meldung
//   - `<fieldset>`/`<legend>` gruppiert die Ziffern zu EINEM Feld
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Beschriftung der Gruppe (Screenreader + sichtbar). */
  label: string;
  /** Fehlertext; steht in der Live-Region und färbt die Felder. */
  error?: string | null;
  /** Anzahl Ziffern (TOTP/SMS = 6). */
  length?: number;
  disabled?: boolean;
  /** Wird gerufen, sobald alle Stellen gefüllt sind (Auto-Absenden). */
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
};

export function OtpInput({
  value,
  onChange,
  label,
  error,
  length = 6,
  disabled,
  onComplete,
  autoFocus,
}: Props) {
  const gruppenId = useId();
  const fehlerId = `${gruppenId}-fehler`;
  const felder = useRef<(HTMLInputElement | null)[]>([]);
  // Merkt sich, für welchen Wert onComplete schon lief — ohne das feuert es bei
  // jedem Rerender erneut und sendet das Formular doppelt ab (Wurzel 2).
  const [zuletztGemeldet, setZuletztGemeldet] = useState<string | null>(null);

  const ziffern = value.padEnd(length, " ").slice(0, length).split("");

  useEffect(() => {
    if (value.length === length && value !== zuletztGemeldet) {
      setZuletztGemeldet(value);
      onComplete?.(value);
    }
    if (value.length < length && zuletztGemeldet !== null) {
      setZuletztGemeldet(null);
    }
  }, [value, length, onComplete, zuletztGemeldet]);

  function setzeZiffer(index: number, ziffer: string) {
    const naechste = ziffern.map((z) => (z === " " ? "" : z));
    naechste[index] = ziffer;
    onChange(naechste.join("").replace(/\s/g, ""));
  }

  function beiEingabe(index: number, roh: string) {
    const nurZiffern = roh.replace(/\D/g, "");
    if (!nurZiffern) {
      setzeZiffer(index, "");
      return;
    }
    // Mehrere Ziffern auf einmal (Autofill des SMS-Codes, schnelles Tippen):
    // ab dem aktuellen Feld verteilen.
    if (nurZiffern.length > 1) {
      verteile(nurZiffern, index);
      return;
    }
    setzeZiffer(index, nurZiffern);
    if (index < length - 1) felder.current[index + 1]?.focus();
  }

  function verteile(text: string, ab = 0) {
    const nurZiffern = text.replace(/\D/g, "").slice(0, length - ab);
    if (!nurZiffern) return;
    const naechste = ziffern.map((z) => (z === " " ? "" : z));
    for (let i = 0; i < nurZiffern.length; i += 1) {
      naechste[ab + i] = nurZiffern[i];
    }
    const neu = naechste.join("").replace(/\s/g, "");
    onChange(neu);
    const zielIndex = Math.min(ab + nurZiffern.length, length - 1);
    felder.current[zielIndex]?.focus();
  }

  function beiTaste(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      // Leeres Feld → eine Stelle zurück und dort löschen (erwartetes Verhalten).
      if (!ziffern[index].trim() && index > 0) {
        e.preventDefault();
        setzeZiffer(index - 1, "");
        felder.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      felder.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      felder.current[index + 1]?.focus();
    }
  }

  return (
    <fieldset
      className="flex flex-col gap-1.5 border-0 p-0"
      aria-describedby={fehlerId}
    >
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex gap-2" dir="ltr">
        {ziffern.map((ziffer, index) => (
          <input
            // Die Position IST die Identität des Feldes — es gibt genau `length`
            // feste Stellen, die nie umsortiert werden.
            key={index}
            ref={(el) => {
              felder.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            // Nur das erste Feld trägt one-time-code: sonst schlägt iOS den
            // kompletten Code in JEDEM Feld einzeln vor.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`${label} — ${index + 1}/${length}`}
            aria-invalid={error ? true : undefined}
            value={ziffer.trim()}
            onChange={(e) => beiEingabe(index, e.target.value)}
            onKeyDown={(e) => beiTaste(index, e)}
            onPaste={(e) => {
              e.preventDefault();
              verteile(e.clipboardData.getData("text"), 0);
            }}
            onFocus={(e) => e.currentTarget.select()}
            className={[
              "h-12 w-11 rounded-(--radius) border bg-background text-center",
              "font-mono text-lg tabular-nums",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-50",
              error ? "border-destructive" : "border-border",
            ].join(" ")}
          />
        ))}
      </div>
      {/* Live-Region steht dauerhaft im DOM — nur so wird die erste Meldung
          zuverlässig vorgelesen. */}
      <p
        id={fehlerId}
        role="alert"
        aria-live="assertive"
        className="min-h-5 text-sm text-destructive"
      >
        {error ?? ""}
      </p>
    </fieldset>
  );
}
