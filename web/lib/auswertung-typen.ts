// Typen der Auswertung — SCHWESTERDATEI zu
// `apps/api/src/features/auswertung/schemas.py`.
//
// Eigene Datei ohne `"use server"`: ein Server-Actions-Modul darf
// AUSSCHLIESSLICH async functions exportieren. Ein `export type` oder
// `export const` darin bricht erst beim Build in „Collecting page data"
// (`A "use server" file can only export async functions`) — tsc und ESLint
// sehen das NICHT.

/** Welcher Buchung welcher Zeitraum zugerechnet wird.
 *
 *  DIE zentrale Entscheidung eines Zeitraumberichts und deshalb eine sichtbare
 *  Wahl, keine Voreinstellung. Alle Wettbewerber führen sie (Beds24 als vier
 *  Werte, Hostaway als „Event-Filter"); Hostaway musste 09/2025 nachbessern,
 *  weil vorher jede Kennzahl anders rechnete. */
export type Bezug = "anreise" | "abreise" | "buchung" | "uebernachtung";

/** Mit welchem früheren Zeitraum verglichen wird.
 *
 *  DATUMSGLEICH, nicht wochentagsgleich (Entscheidung 03.09.2026):
 *  31.08.–29.09.2026 wird zu 31.08.–29.09.2025. Gleiche Kalendertage, gleiche
 *  Feiertage, gleiche Saisonlage. Eine Verschiebung um 52 Wochen ließe das
 *  Datum um bis zu drei Tage wandern und verschöbe Monatsgrenzen. */
export type Vergleich = "keiner" | "1j" | "2j" | "5j";

/** Reihenfolge der Auswahl. `keiner` ist die Vorgabe — der Vergleich kostet
 *  eine zweite Rechnung und wird bewusst eingeschaltet. */
export const VERGLEICHE: readonly Vergleich[] = ["keiner", "1j", "2j", "5j"];

export type Kennzahlen = {
  currency: string | null;
  umsatz: number;
  naechte: number;
  buchungen: number;
  gaeste: number;
  /** Nenner der Auslastung: buchbare Nächte, NICHT alle Kalendertage. Eine
   *  Wartungssperre war nie im Verkauf und darf die Quote nicht drücken. */
  naechte_buchbar: number;
  /** `null` heißt „keine Grundlage", nicht „0 %". Nie als 0 rendern. */
  auslastung_pct: number | null;
  adr: number | null;
  revpar: number | null;
  aufenthalt_schnitt: number | null;
  vorlauf_tage: number | null;
  stornoquote_pct: number | null;
  stornos: number;
};

export type Punkt = {
  period: string;
  umsatz: number;
  naechte: number;
  buchungen: number;
  /** NUR im Vergleichsbericht gesetzt: `period`, um die Vergleichsjahre nach
   *  vorn gerechnet („2025-08-03" → „2026-08-03").
   *
   *  Der Schlüssel, über den die Oberfläche beide Zeitreihen verbindet. Über
   *  die POSITION ginge es nicht: das Backend legt nur Punkte an, in denen
   *  etwas liegt, die Reihen sind also verschieden lang und Index `i` meint in
   *  beiden einen anderen Kalendertag. */
  period_normal?: string | null;
};

export type KanalZeile = {
  channel: string;
  ota_name: string | null;
  buchungen: number;
  naechte: number;
  umsatz: number;
  /** `null`, wo das Portal keine Provision liefert (Booking.com meist nicht).
   *  Bewusst KEIN Schätzwert — Hostaway empfiehlt dort `Preis * 0,15`. */
  provision: number | null;
  netto: number | null;
  anteil_pct: number;
  /** Wie viele dieser Buchungen Eigennutzung sind (kein Umsatz). */
  eigennutzung: number;
};

export type ObjektZeile = {
  property_id: string;
  title: string;
  naechte_buchbar: number;
  naechte_gebucht: number;
  naechte_gesperrt: number;
  /** Tage mit Verkaufssperre (Stop-Sell, scope='all'). Weder belegt noch
   *  verkaufbar — deshalb eine eigene Spalte statt stiller Abzug. */
  naechte_stop_sell: number;
  auslastung_pct: number | null;
  anreisen: number;
  umsatz: number;
  adr: number | null;
  revpar: number | null;
  stornos: number;
};

export type BuchungZeile = {
  id: string;
  property_title: string | null;
  guest_name: string | null;
  channel: string;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  naechte: number;
  gaeste: number | null;
  status: string;
  umsatz: number;
  provision: number | null;
  currency: string | null;
  /** Echter Buchungszeitpunkt der Quelle. `null`, wenn die Quelle ihn nicht
   *  liefert — dann bleibt die Spalte leer, statt auf unsere Uhr auszuweichen. */
  booked_at: string | null;
  is_owner_stay: boolean;
};

export type HerkunftZeile = {
  land: string | null;
  gaeste: number;
  buchungen: number;
  naechte: number;
  anteil_pct: number;
};

export type GaesteBericht = {
  gaeste_gesamt: number;
  wiederkehrer: number;
  wiederkehrer_pct: number | null;
  /** Bezugsgröße der Quote: so viele Personen waren überhaupt zuordenbar.
   *  Ist sie klein, sagt die Quote wenig — die Portale liefern kaum
   *  Mailadressen und legen je Buchung einen neuen Gastdatensatz an. */
  personen_zuordenbar: number;
  buchungen_zuordenbar: number;
  aufenthalt_schnitt: number | null;
  gaeste_je_buchung: number | null;
  herkunft: HerkunftZeile[];
};

/** Der Vorzeitraum — dieselbe Rechnung, andere Daten.
 *
 *  OHNE Buchungsliste: der Reiter „Buchungen" zeigt vom Vorjahr nur die
 *  Summenzeile (`buchungen_gesamt`). Einzelbuchungen von damals wären in der
 *  Tabelle des laufenden Zeitraums nicht unterscheidbar. */
export type VergleichBericht = {
  vergleich: Vergleich;
  von: string;
  bis: string;
  /** Die Währung von DAMALS. Weicht sie von der aktuellen ab, sind Beträge
   *  nicht vergleichbar — dann keine Prozent-Veränderung behaupten (Wurzel 4). */
  currency: string | null;
  waehrungen: string[];
  kennzahlen: Kennzahlen;
  verlauf: Punkt[];
  kanaele: KanalZeile[];
  objekte: ObjektZeile[];
  gaeste: GaesteBericht;
  buchungen_gesamt: number;
};

export type Auswertung = {
  von: string;
  bis: string;
  bezug: Bezug;
  /** `null` bei mehreren Währungen im Zeitraum — dann wird NICHT addiert. */
  currency: string | null;
  waehrungen: string[];
  kennzahlen: Kennzahlen;
  verlauf: Punkt[];
  kanaele: KanalZeile[];
  objekte: ObjektZeile[];
  buchungen: BuchungZeile[];
  gaeste: GaesteBericht;
  /** `null`, wenn kein Vergleich angefordert wurde. Ein leerer Bericht wäre
   *  etwas anderes — er behauptete „Vorjahr: alles null". */
  vorher: VergleichBericht | null;
};

export type AuswertungFilter = {
  von: string;
  bis: string;
  bezug?: Bezug;
  propertyIds?: string[];
  channels?: string[];
  vergleich?: Vergleich;
};

/** Die vier Reiter. Reihenfolge = Anzeigereihenfolge. */
export const REITER = [
  "kennzahlen",
  "analytics",
  "buchungen",
  "auslastung",
  "kanaele",
  "gaeste",
] as const;
export type Reiter = (typeof REITER)[number];
