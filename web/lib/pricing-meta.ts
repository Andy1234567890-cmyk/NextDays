// Preis-Datenmodell (Pricing, Etappe 1: Nightly + Length of stay).
// Gespeichert im flexiblen jsonb-Feld `type_attributes.pricing` eines Objekts —
// keine Migration. Portal-Aufschläge sind Kanal-Pläne (0272), kein Mark-up hier.
import { currencySymbol, formatCurrency } from "@/lib/currency";


// Alle in den 27 EU-Staaten + CH real vorkommenden Währungen (Quelle: laender.ts)
// plus die beiden gängigsten internationalen (USD/GBP). Wurzel 4: nicht 5
// willkürliche Codes hardcoden — die Liste MUSS jede Währung abdecken, in der ein
// Objekt tatsächlich abrechnet, sonst zwingt der Dropdown zu einer falschen Wahl.
export type Currency =
  | "EUR"
  | "CHF"
  | "BGN"
  | "CZK"
  | "DKK"
  | "HUF"
  | "PLN"
  | "RON"
  | "SEK"
  | "USD"
  | "GBP";
export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "EUR", label: "EUR €", symbol: "€" },
  { value: "CHF", label: "CHF", symbol: "CHF" },
  { value: "BGN", label: "BGN лв", symbol: "лв" },
  { value: "CZK", label: "CZK Kč", symbol: "Kč" },
  { value: "DKK", label: "DKK kr", symbol: "kr" },
  { value: "HUF", label: "HUF Ft", symbol: "Ft" },
  { value: "PLN", label: "PLN zł", symbol: "zł" },
  { value: "RON", label: "RON lei", symbol: "lei" },
  { value: "SEK", label: "SEK kr", symbol: "kr" },
  { value: "USD", label: "USD $", symbol: "$" },
  { value: "GBP", label: "GBP £", symbol: "£" },
];

// Symbol und Betragsformat kommen aus der EINEN Quelle (@nextdays/currency über
// lib/currency) — hier standen früher eigene Kopien, deren Zahlenformat vom Rest
// der App abwich (2,5 statt 2,50). Genau die dritte Kopie, die Wurzel 4
// verbietet. Re-Export, damit die Preis-UI ihren gewohnten Namen behält.
export { currencySymbol };

// Externe Kanäle, auf die ein Mark-up angewendet wird (nicht „direct").

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAY_LABELS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mo" },
  { key: "tue", label: "Di" },
  { key: "wed", label: "Mi" },
  { key: "thu", label: "Do" },
  { key: "fri", label: "Fr" },
  { key: "sat", label: "Sa" },
  { key: "sun", label: "So" },
];

// Längen-Preis (Length of stay): Rabatt ab N Nächten.
export type StayKind = "weekly" | "monthly" | "custom";
export type LengthPrice = {
  id: string; // eindeutige ID (für Liste)
  kind: StayKind;
  minNights: number; // ab wie vielen Nächten
  pricePerNight: number; // reduzierter Preis pro Nacht
};

export const STAY_KIND_LABELS: Record<StayKind, string> = {
  weekly: "Wochenpreis",
  monthly: "Monatspreis",
  custom: "Eigener Längenpreis",
};

// --- Etappe 2: Fees, Taxes, Promotions, Add-ons, Other information ---------

// Gebühr (Fee). Berechnung als Einmalbetrag oder pro Gast/Nacht.
export type FeeBasis = "per_stay" | "per_night" | "per_guest_stay" | "per_guest_night";
export const FEE_BASIS_LABELS: Record<FeeBasis, string> = {
  per_stay: "Einmalig pro Aufenthalt",
  per_night: "Pro Nacht",
  per_guest_stay: "Pro Gast / Aufenthalt",
  per_guest_night: "Pro Gast / Nacht",
};
export type Fee = {
  id: string;
  name: string;
  amount: number;
  basis: FeeBasis;
  optional: boolean; // Gast kann ab-/zuwählen
  // Eigener USt-Satz in % (z. B. Frühstück 19 % neben Logis 7 %). Leer =
  // Standard-Übernachtungssatz des Objekts/Kontos (Override-Hierarchie).
  taxRate?: number | null;
};

// Steuer (Taxes): USt./Sales tax ODER lokale Steuer.
export type TaxKind = "vat" | "local";
export type TaxMode = "percent" | "amount";
export const TAX_KIND_LABELS: Record<TaxKind, string> = {
  vat: "USt. / Mehrwertsteuer",
  local: "Lokale Steuer",
};

// Steuerart einer lokalen Steuer. Diese Werte sind KEINE freie Wahl: sie gehen
// als Airbnb-Steuerart an die Portale (Airbnb-Taxonomie), deshalb genau diese
// Codes und keine eigenen.
export type LocalTaxType =
  | "HotelTax"
  | "LodgingTax"
  | "RoomTax"
  | "TourismAssessment"
  | "TouristTax"
  | "TransientOccupancyTax"
  | "Unknown";
export const LOCAL_TAX_TYPES: LocalTaxType[] = [
  "HotelTax",
  "LodgingTax",
  "RoomTax",
  "TourismAssessment",
  "TouristTax",
  "TransientOccupancyTax",
  "Unknown",
];

// Betrags-Steuern: wer wird gezählt (Buchung oder Gast) × pro Aufenthalt oder
// pro Nacht. Die vier Kombinationen bilden das Kurtaxen-Modell („2,50 € pro
// Gast pro Nacht") und werden 1:1 auf die Channex-`logic` abgebildet
// (per_booking / per_night / per_person / per_person_per_night).
export type TaxChargeBasis = "SingleCharge" | "PerPerson";
export type TaxPeriod = "PerStay" | "PerNight";

/** Bemessungsgrundlage „Grundpreis" — neben den Fee-IDs des Objekts. */
export const TAXABLE_BASE_PRICE = "base_price";

export type Tax = {
  id: string;
  kind: TaxKind;
  /** Nur bei kind==="local": Steuerart für die Portale. */
  taxType?: LocalTaxType;
  /** Interner Name (Fallback, wenn keine gastseitige Übersetzung greift). */
  name: string;
  /** Gastseitiger Name je Sprache (Muster wie bei Addons/Services). */
  names?: Record<string, string>;
  /** Interne Beschreibung; serverseitig beim Speichern sanitisiert. */
  descriptionHtml?: string | null;
  mode: TaxMode; // % oder Betrag
  value: number;
  /** Nur bei mode==="amount". */
  chargeBasis?: TaxChargeBasis;
  period?: TaxPeriod;
  /** Nur bei mode==="percent": Fee-IDs und/oder TAXABLE_BASE_PRICE. */
  taxableBase?: string[];
  includedInPrice: boolean; // im Preis enthalten?
};

/** Basis einer Betrags-Steuer, mit der Auslegung für Altdatensätze: ohne
 *  gespeicherte Basis gilt „einmalig pro Nacht" — exakt das, was der
 *  Channex-Sync für `mode:"amount"` bisher gesendet hat (`per_night`). Damit
 *  ändert sich für Bestandsdaten nichts; alles andere wird NICHT geraten. */
export function taxAmountBasis(tax: Tax): { charge: TaxChargeBasis; period: TaxPeriod } {
  return {
    charge: tax.chargeBasis ?? "SingleCharge",
    period: tax.period ?? "PerNight",
  };
}

/** Gastseitiger Name in der gewünschten Sprache, sonst der interne Name. */
export function taxDisplayName(tax: Tax, locale: string): string {
  return tax.names?.[locale]?.trim() || tax.name;
}

// Promotion (Promotions): prozentualer Rabatt mit Bedingungen.
export type Promotion = {
  id: string;
  name: string;
  percent: number;
  conditions: string; // z. B. „nur Juni 2026", Freitext
};

// Add-on (Add-ons): aktivierbares Extra (z. B. Frühstück).
export type AddOn = {
  id: string;
  name: string;
  amount: number;
  basis: FeeBasis;
  active: boolean;
};

export type Pricing = {
  // Wurzel 4: "" = noch keine Währung gewählt (kein erfundenes EUR). Der
  // Währungs-Select im Formular erzwingt die echte Wahl; Beträge rendern bis
  // dahin symbollos (currencySymbol/MoneyInput), statt einen Euro vorzutäuschen.
  currency: Currency | "";
  basePrice: number; // Grundpreis pro Nacht
  dynamicPricing: boolean;
  customByWeekday: boolean; // Preis pro Wochentag anpassen
  weekdayPrices: Record<Weekday, number>; // gilt, wenn customByWeekday
  // Extra guest charge
  extraGuestCharge: number; // Aufschlag pro Gast/Nacht (0 = aus)
  extraGuestFrom: number; // ab dem wievielten Gast
  // Short stay price
  shortStayMaxNights: number; // „kurz" = höchstens N Nächte (0 = aus)
  shortStaySurcharge: number; // Aufschlag pro Nacht
  // Length of stay
  lengthPrices: LengthPrice[];
  // Etappe 2
  fees: Fee[];
  taxes: Tax[];
  promotions: Promotion[];
  addOns: AddOn[];
  businessTaxId: string; // Tax information (Airbnb)
  totRegistrationId: string;
  basePriceLabel: string; // „Label for base price" (Website)
};

export const DEFAULT_PRICING: Pricing = {
  currency: "",
  basePrice: 0,
  dynamicPricing: false,
  customByWeekday: false,
  weekdayPrices: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
  extraGuestCharge: 0,
  extraGuestFrom: 1,
  shortStayMaxNights: 0,
  shortStaySurcharge: 0,
  lengthPrices: [],
  fees: [],
  taxes: [],
  promotions: [],
  addOns: [],
  businessTaxId: "",
  totRegistrationId: "",
  basePriceLabel: "",
};

// Liest die Preise aus einem Objekt (mit Defaults aufgefüllt).
export function readPricing(typeAttributes: Record<string, unknown> | undefined): Pricing {
  const raw = (typeAttributes?.pricing ?? {}) as Partial<Pricing>;
  return {
    ...DEFAULT_PRICING,
    ...raw,
    weekdayPrices: { ...DEFAULT_PRICING.weekdayPrices, ...(raw.weekdayPrices ?? {}) },
    lengthPrices: Array.isArray(raw.lengthPrices) ? raw.lengthPrices : [],
    fees: Array.isArray(raw.fees) ? raw.fees : [],
    taxes: Array.isArray(raw.taxes) ? raw.taxes : [],
    promotions: Array.isArray(raw.promotions) ? raw.promotions : [],
    addOns: Array.isArray(raw.addOns) ? raw.addOns : [],
  };
}

/** Preis in der Sprache der Oberfläche formatieren („450,00 kr").
 *
 *  Dünner Aufsatz auf `formatCurrency` — KEINE eigene Formatierung mehr: die
 *  frühere Kopie nutzte `toLocaleString()` ohne Optionen und schnitt damit
 *  nachlaufende Nullen ab (2,50 € wurde „2,5"), während der Rest der App
 *  centgenau rendert. Eine Wahrheit für alle Beträge (Wurzel 4). Ohne gewählte
 *  Währung bleibt es bei der reinen Zahl, kein erfundenes €.
 */
export function fmtPrice(amount: number, currency: Currency | "", locale: string): string {
  return formatCurrency(amount, currency || null, locale);
}
