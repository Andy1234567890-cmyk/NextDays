// Preis-Datenmodell (Lodgify „Pricing", Etappe 1: Nightly + Length of stay).
// Gespeichert im flexiblen jsonb-Feld `type_attributes.pricing` eines Objekts —
// keine Migration. Mark-up pro externem Kanal (Airbnb/Booking/Google).

import type { Channel } from "@/lib/availability-meta";

export type Currency = "EUR" | "DKK" | "USD" | "GBP" | "CHF";
export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "EUR", label: "EUR €", symbol: "€" },
  { value: "DKK", label: "DKK kr", symbol: "kr" },
  { value: "USD", label: "USD $", symbol: "$" },
  { value: "GBP", label: "GBP £", symbol: "£" },
  { value: "CHF", label: "CHF", symbol: "CHF" },
];

export function currencySymbol(c: Currency): string {
  return CURRENCY_OPTIONS.find((o) => o.value === c)?.symbol ?? c;
}

// Externe Kanäle, auf die ein Mark-up angewendet wird (nicht „direct").
export const MARKUP_CHANNELS: Exclude<Channel, "direct">[] = ["airbnb", "booking", "google"];

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

// Längen-Preis (Lodgify „Length of stay"): Rabatt ab N Nächten.
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

// Gebühr (Lodgify „Fee"). Berechnung als Einmalbetrag oder pro Gast/Nacht.
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
};

// Steuer (Lodgify „Taxes"): USt./Sales tax ODER lokale Steuer.
export type TaxKind = "vat" | "local";
export type TaxMode = "percent" | "amount";
export const TAX_KIND_LABELS: Record<TaxKind, string> = {
  vat: "USt. / Mehrwertsteuer",
  local: "Lokale Steuer",
};
export type Tax = {
  id: string;
  kind: TaxKind;
  name: string;
  mode: TaxMode; // % oder Betrag
  value: number;
  includedInPrice: boolean; // im Preis enthalten?
};

// Promotion (Lodgify „Promotions"): prozentualer Rabatt mit Bedingungen.
export type Promotion = {
  id: string;
  name: string;
  percent: number;
  conditions: string; // z. B. „nur Juni 2026", Freitext
};

// Add-on (Lodgify „Add-ons"): aktivierbares Extra (z. B. Frühstück).
export type AddOn = {
  id: string;
  name: string;
  amount: number;
  basis: FeeBasis;
  active: boolean;
};

export type Pricing = {
  currency: Currency;
  basePrice: number; // Grundpreis pro Nacht
  dynamicPricing: boolean;
  customByWeekday: boolean; // Preis pro Wochentag anpassen
  weekdayPrices: Record<Weekday, number>; // gilt, wenn customByWeekday
  markup: Record<"airbnb" | "booking" | "google", number>; // % je Kanal
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
  currency: "EUR",
  basePrice: 0,
  dynamicPricing: false,
  customByWeekday: false,
  weekdayPrices: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
  markup: { airbnb: 0, booking: 0, google: 0 },
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
    markup: { ...DEFAULT_PRICING.markup, ...(raw.markup ?? {}) },
    lengthPrices: Array.isArray(raw.lengthPrices) ? raw.lengthPrices : [],
    fees: Array.isArray(raw.fees) ? raw.fees : [],
    taxes: Array.isArray(raw.taxes) ? raw.taxes : [],
    promotions: Array.isArray(raw.promotions) ? raw.promotions : [],
    addOns: Array.isArray(raw.addOns) ? raw.addOns : [],
  };
}

// Preis formatieren (z. B. "kr 450").
export function fmtPrice(amount: number, currency: Currency): string {
  return `${currencySymbol(currency)} ${amount.toLocaleString("de-DE")}`;
}
