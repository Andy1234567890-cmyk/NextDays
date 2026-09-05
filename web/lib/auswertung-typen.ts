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
  /** Vom Eigentümer selbst belegte Nächte — belegt, aber ohne Umsatz. */
  naechte_eigennutzung: number;
  auslastung_pct: number | null;
  anreisen: number;
  umsatz: number;
  adr: number | null;
  revpar: number | null;
  stornos: number;
};

/** Eine Zeile je Objekt UND Monat (Hostaway „By month"). */
export type ObjektMonatZeile = ObjektZeile & { monat: string };

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
  /** Finanzfelder aus der Portal-Zerlegung (0366). `null` = keine Zerlegung
   *  gespeichert — dann steht nur der Gesamtpreis, nichts wird zurückgerechnet. */
  uebernachtung: number | null;
  reinigung: number | null;
  sonstige_gebuehren: number | null;
  gebuehren_je_art: Record<string, number>;
  zusatzleistungen: number | null;
  brutto: number | null;
  /** `true` = vom Portal gemeldet, `false` = aus dem Satz errechnet. */
  provision_gemeldet: boolean | null;
  zahlungsgebuehr: number | null;
  netto: number | null;
  finanz_quelle: "ota" | "stammdaten" | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type ObjektFinanzZeile = {
  property_id: string;
  title: string;
  buchungen: number;
  naechte: number;
  umsatz: number;
  uebernachtung: number | null;
  reinigung: number | null;
  sonstige_gebuehren: number | null;
  zusatzleistungen: number | null;
  brutto: number | null;
  provision: number | null;
  zahlungsgebuehr: number | null;
  netto: number | null;
  /** Buchungen ohne Zerlegung — die Summen sind dann unvollständig. */
  ohne_zerlegung: number;
};

/** Leistung je Wochentag, 0 = Montag … 6 = Sonntag. */
export type WochentagZeile = {
  wochentag: number;
  naechte_buchbar: number;
  naechte_gebucht: number;
  auslastung_pct: number | null;
  anreisen: number;
  umsatz: number;
  adr: number | null;
};

export type VerteilungZeile = {
  schluessel: string;
  von: number;
  bis: number | null;
  buchungen: number;
  naechte: number;
  umsatz: number;
  anteil_pct: number;
};

export type StornoKanalZeile = {
  channel: string;
  ota_name: string | null;
  stornos: number;
  naechte: number;
  umsatz_entgangen: number;
  vorlauf_tage: number | null;
  stornoquote_pct: number | null;
};

export type StornoBericht = {
  stornos: number;
  naechte: number;
  umsatz_entgangen: number;
  stornoquote_pct: number | null;
  vorlauf_tage: number | null;
  mit_zeitpunkt: number;
  kanaele: StornoKanalZeile[];
  gruende: { grund: string | null; anzahl: number }[];
  vorlauf: VerteilungZeile[];
};

export type AusgabePosten = {
  id: string;
  date: string;
  name: string;
  kategorie: string | null;
  property_id: string | null;
  property_title: string | null;
  reservation_id: string | null;
  art: "ausgabe" | "extra";
  betrag: number;
  currency: string | null;
  hat_beleg: boolean;
};

export type AusgabeGruppe = {
  schluessel: string | null;
  title: string | null;
  anzahl: number;
  ausgaben: number;
  extras: number;
  saldo: number;
};

export type AusgabenBericht = {
  currency: string | null;
  waehrungen: string[];
  anzahl: number;
  ausgaben: number;
  extras: number;
  saldo: number;
  kategorien: AusgabeGruppe[];
  objekte: AusgabeGruppe[];
  posten: AusgabePosten[];
};

export type PaceMonat = {
  monat: string;
  jetzt_naechte: number;
  jetzt_buchungen: number;
  jetzt_umsatz: number;
  vorjahr_stichtag_naechte: number;
  vorjahr_stichtag_buchungen: number;
  vorjahr_stichtag_umsatz: number;
  vorjahr_ende_naechte: number;
  vorjahr_ende_umsatz: number;
  delta_naechte_pct: number | null;
};

export type PaceBericht = {
  stichtag: string;
  currency: string | null;
  waehrungen: string[];
  monate: PaceMonat[];
  vorjahr_ohne_zeitstempel: number;
};

/** Eine gespeicherte Ansicht (Hostaway „Custom View"), je Nutzer. */
export type Ansicht = {
  id: string;
  name: string;
  reiter: string;
  filter: Record<string, unknown>;
  spalten: string[];
  optionen: Record<string, unknown>;
  created_at: string | null;
};

export type AnsichtAnlegen = Omit<Ansicht, "id" | "created_at">;

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
  wochentage: WochentagZeile[];
  buchungsfenster: VerteilungZeile[];
  aufenthaltsdauer: VerteilungZeile[];
  stornos: StornoBericht;
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
  objekte_finanzen: ObjektFinanzZeile[];
  objekte_monatlich: ObjektMonatZeile[];
  gaeste: GaesteBericht;
  wochentage: WochentagZeile[];
  buchungsfenster: VerteilungZeile[];
  aufenthaltsdauer: VerteilungZeile[];
  stornos: StornoBericht;
  ausgaben: AusgabenBericht;
  verlauf_je_kanal: Record<string, Punkt[]>;
  verlauf_je_objekt: Record<string, Punkt[]>;
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
  status?: string[];
  vergleich?: Vergleich;
};

/** Buchungsstatus als Filter (Hostaway „Statuses"). Die Werte sind die des
 *  DB-Enums `reservation_status`; der Router weist andere mit 422 ab. */
export const STATUS_WERTE = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "completed",
  "cancelled",
  "declined",
  "expired",
  "requested",
] as const;
export type StatusWert = (typeof STATUS_WERTE)[number];

/** Schnellwahl-Zeiträume. Eine gespeicherte Ansicht hält den SCHLÜSSEL
 *  („vormonat"), nicht die Daten — beim Laden wird er neu aufgelöst
 *  (Hostaway: „keine Aktualisierung der Daten erforderlich"). */
export const SCHNELLWAHL = [
  "monat",
  "vormonat",
  "quartal",
  "jahr",
  "vorjahr",
  "letzte30",
  "naechste30",
  "letzte12monate",
  "naechste12monate",
] as const;
export type Schnell = (typeof SCHNELLWAHL)[number];

/** Die Reiter. Reihenfolge = Anzeigereihenfolge. */
export const REITER = [
  "kennzahlen",
  "analytics",
  "buchungen",
  "auslastung",
  "ausgaben",
  "kanaele",
  "gaeste",
  "pace",
  "muster",
  "stornos",
] as const;
export type Reiter = (typeof REITER)[number];
