"use client";

// Ein Schalter mit Titel und Erklärung — die Grundform der Einstellungs-Seiten.
//
// Die Erklärung ist nicht Zierde: jeder dieser Schalter verändert, was ein Gast
// sieht, und der Betrieb muss die Folge kennen, bevor er klickt. Ein Schalter,
// der nur „Basispreise" heißt, lädt zum Ausprobieren ein — auf der eigenen
// Verkaufsseite.
import type { ReactNode } from "react";

export function Schalter({
  titel,
  beschreibung,
  an,
  onAn,
  kinder,
}: {
  titel: string;
  beschreibung: string;
  an: boolean;
  onAn: (an: boolean) => void;
  /** Zusatzfelder, die nur bei eingeschaltetem Schalter Sinn haben (z. B. die
   *  Seitenauswahl unter dem Cookie-Hinweis). Sie stehen im Kasten, damit
   *  sichtbar bleibt, wozu sie gehören. */
  kinder?: ReactNode;
}) {
  return (
    <div className="rounded-(--radius) border border-border">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{titel}</p>
          <p className="pt-1 text-sm text-muted-foreground">{beschreibung}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={an}
          aria-label={titel}
          onClick={() => onAn(!an)}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition " +
            (an ? "bg-foreground" : "bg-border")
          }
        >
          <span
            className={
              "absolute top-0.5 size-5 rounded-full bg-background transition-all " +
              (an ? "left-[1.375rem]" : "left-0.5")
            }
          />
        </button>
      </div>
      {an && kinder ? (
        <div className="border-t border-border p-4">{kinder}</div>
      ) : null}
    </div>
  );
}
