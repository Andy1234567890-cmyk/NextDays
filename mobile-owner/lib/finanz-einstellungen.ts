// Einstellungen der Finanzübersicht (Startseite) — Vorlage: das Blatt
// „Financial settings" der Hostaway Owner App (Berichtseinstellungen ·
// Kennzahlen · Alles zurücksetzen).
//
// WELCHES GELD: ausschließlich die NETTO-Auszahlung des Eigentümers aus
// `/public-portal/finanzen` — dieselbe Zahl wie Kalender und Abrechnung. Es
// gibt hier bewusst keine Kennzahl „Umsatz" oder „Gastpreis" (§4.2): die
// Vorlage zeigt „Rental Revenue", unser Contract liefert es dem Eigentümer
// nicht, und eine Kennzahl, die der Server nicht kennt, wäre eine Erfindung.
import type { PortalFinanzPunkt, PortalFinanzReihe } from "@/lib/ownerPortal";
import type { TextSchluessel } from "@/lib/sprache";
import type { ZeitraumWahl } from "@/lib/zeitraum";

export type Ereignis = "calendar" | "check_in";
export type Vergleich = "keiner" | "vorjahr";
export type Kennzahl = "auszahlung" | "naechte" | "auslastung" | "buchungen" | "je_nacht";
export type Diagrammtyp = "linie" | "balken";

export type FinanzEinstellungen = {
  /** null = alle Objekte. */
  propertyId: string | null;
  zeitraum: ZeitraumWahl;
  ereignis: Ereignis;
  vergleich: Vergleich;
  diagramm: Kennzahl;
  diagrammtyp: Diagrammtyp;
  /** Genau zwei Nebenkennzahlen unter dem Diagramm. */
  nebenkennzahlen: [Kennzahl, Kennzahl];
};

export const STANDARD: FinanzEinstellungen = {
  propertyId: null,
  zeitraum: "aktueller_monat",
  ereignis: "calendar",
  vergleich: "keiner",
  diagramm: "auszahlung",
  diagrammtyp: "linie",
  nebenkennzahlen: ["auslastung", "je_nacht"],
};

// Textschlüssel statt Texte: die Wahl wird gespeichert und der Bericht in der
// Sprache der Oberfläche beschriftet.
export const EREIGNIS_SCHLUESSEL: Record<Ereignis, TextSchluessel> = {
  calendar: "finanz.ereignisKalender",
  check_in: "finanz.ereignisAnreise",
};

export const EREIGNIS_HINWEIS_SCHLUESSEL: Record<Ereignis, TextSchluessel> = {
  calendar: "finanz.ereignisKalenderHinweis",
  check_in: "finanz.ereignisAnreiseHinweis",
};

export const VERGLEICH_SCHLUESSEL: Record<Vergleich, TextSchluessel> = {
  keiner: "finanz.vergleichKeiner",
  vorjahr: "finanz.vergleichVorjahr",
};

export const KENNZAHL_SCHLUESSEL: Record<Kennzahl, TextSchluessel> = {
  auszahlung: "kennzahl.auszahlung",
  naechte: "kennzahl.belegteNaechte",
  auslastung: "kennzahl.auslastung",
  buchungen: "kennzahl.buchungen",
  je_nacht: "kennzahl.jeNacht",
};

/** Der ⓘ-Text zur Kennzahl — sagt, WAS die Zahl ist und was sie nicht ist. */
export const KENNZAHL_HINWEIS_SCHLUESSEL: Record<Kennzahl, TextSchluessel> = {
  auszahlung: "kennzahl.auszahlungHilfeLang",
  naechte: "kennzahl.naechteHilfe",
  auslastung: "kennzahl.auslastungHilfeLang",
  buchungen: "kennzahl.buchungenHilfe",
  je_nacht: "kennzahl.jeNachtHilfeLang",
};

export const DIAGRAMMTYP_SCHLUESSEL: Record<Diagrammtyp, TextSchluessel> = {
  linie: "finanz.linienDiagramm",
  balken: "finanz.balkenDiagramm",
};

export const KENNZAHLEN: Kennzahl[] = ["auszahlung", "naechte", "auslastung", "buchungen", "je_nacht"];

/** Ist die Kennzahl eine Geldzahl? Entscheidet über Währung im Format. */
export function istGeld(k: Kennzahl): boolean {
  return k === "auszahlung" || k === "je_nacht";
}

/** Wert eines Punktes für die Diagramm-Kennzahl; null = nicht ausweisbar. */
export function punktWert(p: PortalFinanzPunkt, k: Kennzahl): number | null {
  switch (k) {
    case "auszahlung":
      return p.payout;
    case "naechte":
      return p.nights;
    case "auslastung":
      return p.occupancy_rate;
    case "buchungen":
      return p.reservations;
    case "je_nacht":
      return p.payout !== null && p.nights > 0 ? p.payout / p.nights : null;
  }
}

/** Summenwert einer Reihe für die Kennzahl; null = nicht ausweisbar. */
export function reihenWert(r: PortalFinanzReihe, k: Kennzahl): number | null {
  switch (k) {
    case "auszahlung":
      return r.payout_total;
    case "naechte":
      return r.nights;
    case "auslastung":
      return r.occupancy_rate;
    case "buchungen":
      return r.reservations;
    case "je_nacht":
      return r.avg_payout_per_night;
  }
}

/**
 * Nebenkennzahl an Position i tauschen. Ist die neue Kennzahl schon an der
 * anderen Position, wandern beide (Tausch) — sonst stünde dieselbe Zahl
 * zweimal nebeneinander.
 */
export function nebenkennzahlSetzen(
  paar: [Kennzahl, Kennzahl],
  i: 0 | 1,
  neu: Kennzahl,
): [Kennzahl, Kennzahl] {
  const andere = i === 0 ? 1 : 0;
  if (paar[andere] === neu) return i === 0 ? [neu, paar[0]] : [paar[1], neu];
  return i === 0 ? [neu, paar[1]] : [paar[0], neu];
}

/** Weicht etwas vom Standard ab? Steuert, ob „Alles zurücksetzen" aktiv ist. */
export function istStandard(e: FinanzEinstellungen): boolean {
  return (
    e.propertyId === STANDARD.propertyId &&
    e.zeitraum === STANDARD.zeitraum &&
    e.ereignis === STANDARD.ereignis &&
    e.vergleich === STANDARD.vergleich &&
    e.diagramm === STANDARD.diagramm &&
    e.diagrammtyp === STANDARD.diagrammtyp &&
    e.nebenkennzahlen[0] === STANDARD.nebenkennzahlen[0] &&
    e.nebenkennzahlen[1] === STANDARD.nebenkennzahlen[1]
  );
}
