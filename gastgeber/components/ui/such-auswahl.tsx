"use client";

// Auswahlfeld mit Suche — für lange Listen (Zeitzonen, Währungen, Länder).
//
// Warum kein <select>: Bei über 400 Zeitzonen ist die native Liste
// unbenutzbar. Man kann nur tippen, was am Anfang steht — „Berlin" findet
// nichts, weil der Eintrag „(GMT+02:00) Berlin" heißt.
//
// Tastatur ist vollständig bedienbar, weil ein reines Maus-Dropdown für viele
// Nutzer gar nicht erreichbar wäre: ↑/↓ wandern, Enter wählt, Escape schließt.
// Die Rollen (combobox/listbox/option) sagen Screenreadern, was das Ding ist.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SuchOption {
  wert: string;
  label: string;
  /** Zusätzliche Begriffe, unter denen der Eintrag gefunden werden soll —
   *  z. B. die IANA-ID „Europe/Berlin" zum Label „(GMT+02:00) Berlin". */
  stichworte?: string;
}

export function SuchAuswahl({
  optionen,
  wert,
  onChange,
  platzhalter,
  suchPlatzhalter,
  disabled = false,
}: {
  optionen: SuchOption[];
  wert: string;
  onChange: (wert: string) => void;
  platzhalter?: string;
  suchPlatzhalter?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("gemeinsam");
  // Die Vorgaben kommen aus den Übersetzungen, nicht aus Default-Parametern —
  // ein Default-String im Signatur-Kopf wäre in jeder Sprache deutsch.
  const platzhalterText = platzhalter ?? t("bitteWaehlen");
  const suchText = suchPlatzhalter ?? t("suchen");
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const [markiert, setMarkiert] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  const gewaehlt = optionen.find((o) => o.wert === wert);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return optionen;
    // Alle Suchbegriffe müssen vorkommen, Reihenfolge egal: „berlin gmt"
    // findet denselben Eintrag wie „gmt berlin".
    const teile = q.split(/\s+/);
    return optionen.filter((o) => {
      const heuhaufen = `${o.label} ${o.stichworte ?? ""}`.toLowerCase();
      return teile.every((t) => heuhaufen.includes(t));
    });
  }, [optionen, suche]);

  // Klick nach außen schließt. Ohne das bliebe die Liste offen, wenn der
  // Nutzer woanders hinklickt — und überdeckte den Rest der Seite.
  useEffect(() => {
    if (!offen) return;
    function aussen(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOffen(false);
      }
    }
    document.addEventListener("mousedown", aussen);
    return () => document.removeEventListener("mousedown", aussen);
  }, [offen]);

  // Beim Öffnen ins Suchfeld springen und beim aktuellen Wert stehen.
  useEffect(() => {
    if (!offen) return;
    feld.current?.focus();
    const i = treffer.findIndex((o) => o.wert === wert);
    setMarkiert(i >= 0 ? i : 0);
  }, [offen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Die markierte Zeile in den sichtbaren Bereich holen — sonst wandert die
  // Markierung bei ↓ unsichtbar aus dem Bild.
  useEffect(() => {
    if (!offen) return;
    liste.current?.children[markiert]?.scrollIntoView({ block: "nearest" });
  }, [markiert, offen]);

  function waehle(o: SuchOption) {
    onChange(o.wert);
    setOffen(false);
    setSuche("");
  }

  function taste(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkiert((i) => Math.min(i + 1, treffer.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkiert((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = treffer[markiert];
      if (o) waehle(o);
    } else if (e.key === "Escape") {
      setOffen(false);
      setSuche("");
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOffen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={offen}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background ps-3 pe-4 text-start text-[0.9375rem] outline-none focus-visible:border-foreground disabled:opacity-60"
      >
        <span className={gewaehlt ? "" : "text-muted-foreground"}>
          {gewaehlt?.label ?? platzhalterText}
        </span>
        <Icon
          icon="ph:caret-down"
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      </button>

      {offen && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Icon
              icon="ph:magnifying-glass"
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <input
              ref={feld}
              value={suche}
              onChange={(e) => {
                setSuche(e.target.value);
                setMarkiert(0);
              }}
              onKeyDown={taste}
              placeholder={suchText}
              aria-label={suchText}
              role="combobox"
              aria-expanded={offen}
              aria-controls="such-auswahl-liste"
              className="h-11 w-full bg-transparent text-[0.9375rem] outline-none"
            />
          </div>

          {treffer.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("nichtsGefunden")}
            </p>
          ) : (
            <ul
              ref={liste}
              id="such-auswahl-liste"
              role="listbox"
              className="max-h-72 overflow-y-auto py-1"
            >
              {treffer.map((o, i) => (
                <li key={o.wert} role="option" aria-selected={o.wert === wert}>
                  <button
                    type="button"
                    onClick={() => waehle(o)}
                    onMouseEnter={() => setMarkiert(i)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[0.9375rem] ${
                      i === markiert ? "bg-muted" : ""
                    }`}
                  >
                    <span>{o.label}</span>
                    {o.wert === wert && (
                      <Icon
                        icon="ph:check"
                        aria-hidden
                        className="size-4 shrink-0"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
