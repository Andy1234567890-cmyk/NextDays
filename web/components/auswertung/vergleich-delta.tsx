"use client";

// Die Vergleichsanzeige — EIN Baustein für alle sieben Stellen der Auswertung
// (Kachelreihe, Kennzahlen, Verlauf, Buchungen, Auslastung, Kanäle, Gäste).
//
// WARUM ZENTRAL (03.09.2026):
// Ein Delta ist keine Formatierung, sondern eine AUSSAGE — „12 % mehr als im
// Vorjahr". Sie darf nur fallen, wenn sie stimmt. Die drei Fälle, in denen sie
// NICHT fallen darf, sind fachlich und nicht offensichtlich; siebenmal kopiert
// wäre einer davon spätestens beim vierten Mal vergessen worden:
//
//   1. KEIN VORWERT (`null`): der Vorzeitraum hatte diese Größe nicht (kein
//      Kalender gepflegt, kein Nenner). „—", kein Delta.
//   2. VORWERT NULL: eine Steigerung von 0 auf 400 ist nicht „+∞ %" und auch
//      nicht „+100 %" — es gibt keine sinnvolle Rate. Gezeigt wird der
//      absolute Vorwert („vorher 0"), nicht eine erfundene Prozentzahl
//      (Wurzel 4).
//   3. WÄHRUNGSWECHSEL: lag der Vorzeitraum in einer anderen Währung, sind
//      Beträge NICHT vergleichbar. 60.000 DKK gegen 8.000 EUR ergäben „−87 %"
//      — eine Zahl, die niemand als falsch erkennt, weil sie plausibel
//      aussieht. Solche Deltas werden unterdrückt und begründet.
//
// RICHTUNG IST NICHT IMMER GUT: bei der Stornoquote ist ein Anstieg schlecht.
// Deshalb `invertiert` statt einer festen Farbregel „hoch = grün".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Vergleich } from "@/lib/auswertung-typen";

/** Wie sich ein Wert zum Vorwert verhält — oder warum das nicht sagbar ist. */
export type DeltaStand =
  | { art: "kein-vorwert" }
  | { art: "waehrung-abweichend"; waehrung: string | null }
  | { art: "vorwert-null" }
  | { art: "delta"; prozent: number };

/**
 * Der Vergleich zweier Werte — die einzige Stelle, die entscheidet, ob ein
 * Delta überhaupt eine gültige Aussage ist.
 *
 * `waehrungGleich` ist für Beträge zu übergeben; für Zählgrößen (Nächte,
 * Buchungen, Gäste) bleibt es `true` — die sind währungsunabhängig.
 */
export function deltaStand(
  jetzt: number | null,
  vorher: number | null,
  { waehrungGleich = true, vorherWaehrung = null }: {
    waehrungGleich?: boolean;
    vorherWaehrung?: string | null;
  } = {},
): DeltaStand {
  if (!waehrungGleich) {
    return { art: "waehrung-abweichend", waehrung: vorherWaehrung };
  }
  if (vorher === null || jetzt === null) return { art: "kein-vorwert" };
  if (vorher === 0) return { art: "vorwert-null" };
  return { art: "delta", prozent: ((jetzt - vorher) / Math.abs(vorher)) * 100 };
}

/**
 * Die kleine Zeile unter einem Wert: Pfeil, Prozent, Vorwert.
 *
 * `vorherAnzeige` ist der bereits FORMATIERTE Vorwert (Betrag mit Währung,
 * Prozentwert mit Zeichen). Diese Komponente formatiert nicht selbst — sonst
 * bräuchte sie die Währungsregeln ein zweites Mal.
 */
export function VergleichDelta({
  stand,
  vorherAnzeige,
  invertiert = false,
  klein = false,
}: {
  stand: DeltaStand;
  vorherAnzeige: string;
  /** true, wenn ein Anstieg SCHLECHT ist (Stornoquote). */
  invertiert?: boolean;
  klein?: boolean;
}) {
  const t = useTranslations("analysis");
  const groesse = klein ? "text-[0.6875rem]" : "text-xs";

  if (stand.art === "waehrung-abweichend") {
    return (
      <span
        className={`flex items-center gap-1 ${groesse} text-muted-foreground`}
        title={t("compareCurrencyMismatchHint")}
      >
        <Icon icon="ph:warning-circle" className="size-3 shrink-0" />
        {stand.waehrung
          ? t("compareCurrencyMismatch", { currency: stand.waehrung })
          : t("compareCurrencyUnclear")}
      </span>
    );
  }

  if (stand.art === "kein-vorwert") {
    return (
      <span className={`${groesse} text-muted-foreground`}>
        {t("compareNoBase")}
      </span>
    );
  }

  if (stand.art === "vorwert-null") {
    // Kein „+100 %" und kein „+∞ %": von null aus gibt es keine Rate. Der
    // absolute Vorwert ist die ehrliche Auskunft.
    return (
      <span className={`${groesse} text-muted-foreground`}>
        {t("comparePrevious", { value: vorherAnzeige })}
      </span>
    );
  }

  const gerundet = Math.round(stand.prozent * 10) / 10;
  const hoch = gerundet > 0;
  // Exakt 0 % ist weder gut noch schlecht — grau, kein Pfeil nach oben.
  const farbe =
    gerundet === 0
      ? "text-muted-foreground"
      : hoch !== invertiert
        ? "text-emerald-600"
        : "text-red-600";
  const icon =
    gerundet === 0
      ? "ph:minus"
      : hoch
        ? "ph:trend-up"
        : "ph:trend-down";

  return (
    <span className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${groesse}`}>
      <span className={`flex items-center gap-0.5 font-semibold ${farbe}`}>
        <Icon icon={icon} className="size-3 shrink-0" aria-hidden />
        {hoch ? "+" : ""}
        {gerundet.toLocaleString(undefined, { maximumFractionDigits: 1 })} %
      </span>
      <span className="text-muted-foreground">
        {t("comparePrevious", { value: vorherAnzeige })}
      </span>
    </span>
  );
}

/** Die Kopfzeile „Vergleich mit 31.08.–29.09.2025" über einer Tabelle. */
export function VergleichHinweis({
  vergleich,
  von,
  bis,
}: {
  vergleich: Vergleich;
  von: string;
  bis: string;
}) {
  const t = useTranslations("analysis");
  if (vergleich === "keiner") return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon icon="ph:chart-line" className="size-3.5 shrink-0" />
      {t("compareBanner", {
        label: t(`compare.${vergleich}`),
        von: new Date(von).toLocaleDateString(),
        bis: new Date(bis).toLocaleDateString(),
      })}
    </p>
  );
}
