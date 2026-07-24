"use client";

// Editierbarer Text-Abschnitt (Titel / Beschreibung) im Airbnb-„Listing editor"-
// Stil: KEINE Karte + „Bearbeiten", sondern eine große, zentrierte Live-Vorschau,
// die man direkt beschreibt. Oben ein Restzeichen-Zähler („N/max verfügbar"),
// unten ein dezenter Tipp-Hinweis, unten rechts „Speichern" (deaktiviert, solange
// unverändert). Auto-wachsendes, transparentes Textfeld → Vorschau == Eingabe.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function TextPanel({
  titel,
  wert,
  platzhalter,
  mehrzeilig,
  maxLen,
  onSave,
}: {
  titel: string;
  wert: string;
  platzhalter: string;
  mehrzeilig: boolean;
  // Airbnb-Zeichenlimit (Titel 50, Beschreibung 500).
  maxLen: number;
  onSave: (v: string) => Promise<boolean>;
}) {
  const t = useTranslations("objektEditor");
  const [entwurf, setEntwurf] = useState(wert);
  const [busy, setBusy] = useState(false);
  const feld = useRef<HTMLTextAreaElement>(null);

  // Bei Objekt-/Abschnittswechsel den Entwurf mit dem gespeicherten Wert synchronisieren.
  useEffect(() => {
    setEntwurf(wert);
  }, [wert]);

  // Textarea an den Inhalt anpassen (auto-grow) — die Vorschau wächst mit.
  useLayoutEffect(() => {
    const el = feld.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [entwurf]);

  const verbleibend = maxLen - entwurf.length;
  const geaendert = entwurf.trim() !== wert.trim();

  async function speichern() {
    if (!geaendert) return;
    setBusy(true);
    await onSave(entwurf.trim());
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Restzeichen-Zähler, zentriert oben (Airbnb: „13/50 available"). */}
      <p className="mb-6 text-center text-xs font-medium text-muted-foreground">
        {t("zeichenVerbleibend", { n: verbleibend, max: maxLen })}
      </p>

      {/* Große, zentrierte Eingabe = Live-Vorschau. */}
      <div className="flex flex-1 items-center justify-center">
        <textarea
          ref={feld}
          value={entwurf}
          maxLength={maxLen}
          rows={1}
          disabled={busy}
          placeholder={platzhalter}
          aria-label={titel}
          onChange={(e) => setEntwurf(e.target.value)}
          onKeyDown={(e) => {
            // Einzeiliger Titel: Enter speichert statt Zeilenumbruch.
            if (!mehrzeilig && e.key === "Enter") {
              e.preventDefault();
              void speichern();
            }
          }}
          className={`w-full resize-none overflow-hidden bg-transparent text-center font-sans font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50 ${
            mehrzeilig
              ? "max-w-2xl text-[1.5rem]"
              : "max-w-3xl text-[2.75rem]"
          }`}
          autoFocus
        />
      </div>

      {/* Dezenter Tipp-Hinweis, zentriert unten. */}
      <div className="mb-6 flex justify-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon icon="ph:lightbulb" className="size-[1.15rem]" />
        </span>
      </div>

      {/* „Speichern" unten rechts — deaktiviert, solange unverändert. */}
      <div className="flex justify-end border-t border-border pt-5">
        <button
          type="button"
          onClick={() => void speichern()}
          disabled={busy || !geaendert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? t("speichert") : t("speichern")}
        </button>
      </div>
    </div>
  );
}
