"use client";

// Editierbarer Text-Abschnitt (Titel / Beschreibung) im Airbnb-„Listing editor"-
// Stil: KEINE Karte + „Bearbeiten", sondern eine große, zentrierte Live-Vorschau,
// die man direkt beschreibt. Oben ein Restzeichen-Zähler („N/max verfügbar"),
// unten ein dezenter Tipp-Hinweis. Vollscreen-Editor ohne eigenen Save-Button —
// jede Änderung wird sofort gespeichert (onSave = Server-Persist, wie Airbnb ein
// Vollscreen-Feld beim Tippen sichert). Auto-wachsendes Textfeld → Vorschau == Eingabe.
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

  // Eingabe hält nur den lokalen Entwurf; gespeichert wird beim Verlassen des Felds
  // (onBlur) — ein Server-Call pro Tastendruck wäre zu viel. Nur speichern, wenn
  // sich der Wert wirklich geändert hat.
  function sichern() {
    const v = entwurf.trim();
    if (v !== wert.trim()) void onSave(v);
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
          placeholder={platzhalter}
          aria-label={titel}
          onChange={(e) => setEntwurf(e.target.value)}
          onBlur={sichern}
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
    </div>
  );
}
