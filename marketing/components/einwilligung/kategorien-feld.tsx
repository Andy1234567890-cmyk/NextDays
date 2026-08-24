"use client";

// Die Kategorienliste — EIN Baustein für beide Orte: die Leiste unten und das
// Einstellungsfeld auf der Cookie-Richtlinie. Zwei Kopien würden auseinander
// laufen, und dann stünde in der Leiste ein anderer Zweck als im Widerruf.
//
// Die notwendige Kategorie hat KEINEN Schalter, auch keinen ausgegrauten: ein
// Schalter, den man nicht bewegen kann, verspricht eine Wahl, die es nicht
// gibt. Stattdessen steht dort „immer aktiv" als Text.
import { useTranslations } from "next-intl";

import {
  type Auswahl,
  OPTIONALE_KATEGORIEN,
  type OptionaleKategorie,
} from "@/lib/einwilligung";
import { cn } from "@/lib/utils";

function Schalter({
  an,
  label,
  umschalten,
}: {
  an: boolean;
  label: string;
  umschalten: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={label}
      onClick={umschalten}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        an ? "bg-accent" : "bg-border",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-background shadow-card transition-transform",
          an ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function KategorienFeld({
  auswahl,
  setzen,
}: {
  auswahl: Auswahl;
  setzen: (kategorie: OptionaleKategorie, an: boolean) => void;
}) {
  const t = useTranslations("einwilligung");

  return (
    // `min-w-0` durchgehend: Ohne das wächst ein langes Kompositum (Deutsch,
    // Finnisch, Ungarisch) die Spalte über die Bildschirmbreite hinaus und die
    // ganze Seite scrollt quer — dieselbe Ursache wie an den Überschriften
    // (app/globals.css).
    <ul className="flex min-w-0 flex-col gap-4">
      <li className="min-w-0 rounded-2xl bg-surface-warm p-4">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 break-words text-sm font-semibold">
            {t("kategorien.notwendig.titel")}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {t("immerAktiv")}
          </p>
        </div>
        <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
          {t("kategorien.notwendig.text")}
        </p>
      </li>

      {OPTIONALE_KATEGORIEN.map((kategorie) => (
        <li key={kategorie} className="min-w-0 rounded-2xl bg-surface-warm p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">
                {t(`kategorien.${kategorie}.titel`)}
              </p>
              <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
                {t(`kategorien.${kategorie}.text`)}
              </p>
            </div>
            <Schalter
              an={auswahl[kategorie]}
              label={t(`kategorien.${kategorie}.titel`)}
              umschalten={() => setzen(kategorie, !auswahl[kategorie])}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
