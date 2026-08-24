"use client";

// Symbol-Auswahl für den Merkmale-Abschnitt (0432).
//
// Eine feste Liste und kein freies Iconify-Suchfeld. Der Grund ist nicht
// Bequemlichkeit: ein freier Name, den der Renderer nicht kennt, zeigt gar
// nichts an — und niemand käme darauf, dass er sich vertippt hat. Eine Auswahl
// aus 200 000 Iconify-Symbolen wäre außerdem keine Auswahl, sondern eine
// Suchaufgabe für jemanden, der eine Ferienwohnung vermietet.
//
// Die Schlüssel MÜSSEN mit `SYMBOLE` in
// `builder/components/blocks/merkmale.tsx` deckungsgleich sein. Ein Schlüssel,
// den nur diese Liste kennt, bleibt auf der Website unsichtbar; einer, den nur
// der Renderer kennt, ist unerreichbar. `scripts/i18n/blocktypen-pruefen.mjs`
// hält beide Listen gleich.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

/** Schlüssel → Iconify-Name. Auf Unterkünfte zugeschnitten. */
export const MERKMAL_SYMBOLE: Record<string, string> = {
  wlan: "ph:wifi-high",
  parken: "ph:car",
  kueche: "ph:cooking-pot",
  fruehstueck: "ph:coffee",
  pool: "ph:swimming-pool",
  sauna: "ph:thermometer-hot",
  haustiere: "ph:paw-print",
  familie: "ph:users-three",
  fahrrad: "ph:person-simple-bike",
  strand: "ph:umbrella",
  berge: "ph:mountains",
  garten: "ph:tree",
  kamin: "ph:fire",
  waschmaschine: "ph:washing-machine",
  klimaanlage: "ph:wind",
  barrierefrei: "ph:wheelchair",
  schluessel: "ph:key",
  uhr: "ph:clock",
  herz: "ph:heart",
  stern: "ph:star",
  haus: "ph:house-line",
  karte: "ph:map-trifold",
};

export function SymbolFeld({
  label,
  wert,
  onWert,
}: {
  label: string;
  wert: unknown;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const gewaehlt = typeof wert === "string" ? wert : null;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {/* „Keines" als erste Wahl und nicht als leerer Eintrag am Ende: kein
            Symbol ist ein gültiger Zustand, und der Kunde muss ihn
            zurücknehmen können, ohne den Abschnitt zu löschen. */}
        <button
          type="button"
          aria-pressed={gewaehlt === null}
          aria-label={t("felder.symbolKeines")}
          title={t("felder.symbolKeines")}
          onClick={() => onWert(null)}
          className={
            "flex size-8 items-center justify-center rounded-(--radius) border transition " +
            (gewaehlt === null
              ? "border-foreground bg-secondary"
              : "border-border hover:bg-secondary/60")
          }
        >
          <Icon icon="ph:prohibit" className="size-4 text-muted-foreground" />
        </button>
        {Object.entries(MERKMAL_SYMBOLE).map(([schluessel, icon]) => (
          <button
            key={schluessel}
            type="button"
            aria-pressed={gewaehlt === schluessel}
            // Der Name des Symbols als Beschriftung: ohne ihn ist die Auswahl
            // für Screenreader eine Reihe namenloser Knöpfe.
            aria-label={t(`felder.symbolName.${schluessel}`)}
            title={t(`felder.symbolName.${schluessel}`)}
            onClick={() => onWert(schluessel)}
            className={
              "flex size-8 items-center justify-center rounded-(--radius) border transition " +
              (gewaehlt === schluessel
                ? "border-foreground bg-secondary"
                : "border-border hover:bg-secondary/60")
            }
          >
            <Icon icon={icon} className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
