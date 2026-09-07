// Die wählbaren Stornorichtlinien — Aufbau wie im Vorbild (Airbnb zeigt unter
// „Stornierungen" benannte Richtlinien mit je zwei Sätzen, nicht ein leeres
// Formular). Am 06.09.2026 abgenommen: „Flexibel" (bis 1 Tag), „Moderat"
// (bis 5 Tage), „Eingeschränkt" (bis 14 Tage), jeweils mit anteiliger
// Erstattung danach.
//
// Bei uns ist eine Richtlinie kein eigener Datentyp, sondern eine
// BUCHUNGSBEDINGUNG (`booking_conditions`, 0165) mit einer Staffel: die Wahl
// legt sie an (oder findet die vorhandene mit demselben Namen) und hängt sie an
// den Preisplan. Damit bleibt EIN Datenmodell — die Richtlinien sind nur seine
// gebräuchlichsten Ausprägungen.

/** Ein Richtlinien-Bauplan: Name, Beschreibungssätze, Staffel. */
export interface StornoRichtlinie {
  /** Stabiler Schlüssel für Übersetzung und Wiedererkennung. */
  key:
    | "flexibel"
    | "moderat"
    | "eingeschraenkt"
    | "lang_moderat"
    | "lang_streng";
  /** Interner Name der Bedingung — er identifiziert sie beim Wiederfinden. */
  name: string;
  modus: "refundable" | "partial" | "non_refundable";
  /** Staffel: X % zurück ab Y Tagen vor Anreise. */
  staffel: { refund_percent: number; days_before_arrival: number }[];
}

/** Ab wie vielen Nächten die Langzeit-Richtlinie gilt (wie im Vorbild: 28). */
export const LANGZEIT_AB_NAECHTEN = 28;

/** Die drei Richtlinien für KURZE Aufenthalte (unter 28 Nächten). */
export const STORNO_RICHTLINIEN: StornoRichtlinie[] = [
  {
    key: "flexibel",
    name: "Flexibel",
    modus: "partial",
    staffel: [{ refund_percent: 100, days_before_arrival: 1 }],
  },
  {
    key: "moderat",
    name: "Moderat",
    modus: "partial",
    staffel: [{ refund_percent: 100, days_before_arrival: 5 }],
  },
  {
    key: "eingeschraenkt",
    name: "Eingeschränkt",
    modus: "partial",
    staffel: [
      { refund_percent: 100, days_before_arrival: 14 },
      { refund_percent: 50, days_before_arrival: 7 },
    ],
  },
];

/** Die Richtlinien für LANGE Aufenthalte (ab 28 Nächten). */
export const STORNO_RICHTLINIEN_LANG: StornoRichtlinie[] = [
  {
    key: "lang_moderat",
    name: "Moderat (Langzeit)",
    modus: "partial",
    staffel: [{ refund_percent: 100, days_before_arrival: 30 }],
  },
  {
    key: "lang_streng",
    name: "Streng (Langzeit)",
    modus: "partial",
    staffel: [{ refund_percent: 100, days_before_arrival: 28 }],
  },
];

/** Der Name der nicht erstattungsfähigen Bedingung (Schalter der dritten Karte). */
export const NICHT_ERSTATTBAR: StornoRichtlinie = {
  key: "flexibel",
  name: "Nicht erstattungsfähig",
  modus: "non_refundable",
  staffel: [],
};

/**
 * Welche Richtlinie eine bestehende Bedingung ist — erkannt am Namen, sonst
 * `null` (eine von Hand angelegte Bedingung ist keine der Vorlagen und wird
 * mit ihrem eigenen Namen gezeigt, nicht in eine Schublade gesteckt).
 */
export function richtlinieZuName(name: string): StornoRichtlinie | null {
  return (
    [...STORNO_RICHTLINIEN, ...STORNO_RICHTLINIEN_LANG].find(
      (r) => r.name === name,
    ) ?? null
  );
}
