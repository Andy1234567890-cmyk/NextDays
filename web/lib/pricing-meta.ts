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

/** i18n-Schlüssel je Aufenthaltsart. Hier standen bis 04.08.2026 deutsche
 *  Klartexte — ein dänischer Betrieb las „Wochenpreis" mitten in einer
 *  dänischen Oberfläche. Die Schlüssel gibt es in allen 24 Sprachen, weil das
 *  Auswahlmenü sie schon nutzt. */
export const STAY_KIND_KEYS: Record<StayKind, string> = {
  weekly: "pricingForm.weeklyPriceLabel",
  monthly: "pricingForm.monthlyPriceLabel",
  custom: "pricingForm.customLengthPriceLabel",
};

/** Gesamtpreis des Aufenthalts, wie der Branchenstandard ihn führt
 *  („Wöchentlicher Gesamtpreis kr 2835" statt „kr 405 / Nacht", live abgelesen
 *  04.08.2026).
 *
 *  Gespeichert bleibt der NACHTPREIS: den liest der Preis-Resolver
 *  (`_PricingConfig.length_price_per_night`), und nur er ist eindeutig — bei
 *  „7 Nächte oder mehr" wäre ein Gesamtpreis für eine 9-Nacht-Buchung nicht
 *  definiert. Der Gesamtpreis ist deshalb eine ANSICHT auf denselben Wert, keine
 *  zweite Zahl im Datensatz (Wurzel 4). */
export function lengthTotal(pricePerNight: number, minNights: number): number {
  return pricePerNight * Math.max(1, minNights);
}

/** Gesamtpreis → Nachtpreis. Zwei Nachkommastellen, weil Beträge so gerechnet
 *  und gerendert werden; ohne Rundung stünde 2835/7 als 404.99999999999994 im
 *  Datensatz. */
export function lengthPerNight(total: number, minNights: number): number {
  return Math.round((total / Math.max(1, minNights)) * 100) / 100;
}

// --- Etappe 2: Fees, Taxes, Promotions, Add-ons, Other information ---------

// Gebühr (Fee). Zwei Achsen wie im Branchenstandard: „Einmaliger Betrag | Pro
// Gast" × „Pro Aufenthalt | Pro Nacht" — hier als die vier möglichen
// Kombinationen in EINEM Wert (genau vier gibt es).
export type FeeBasis =
  | "per_stay"
  | "per_night"
  | "per_guest_stay"
  | "per_guest_night"
  | "per_pet_stay";
/** i18n-Schlüssel je Basis, als die zwei Achsen des Standards („Einmaliger
 *  Betrag · Pro Aufenthalt"). Hier standen bis 04.08.2026 deutsche Klartexte —
 *  in einer dänischen Oberfläche las die Gebührenzeile „Einmalig pro
 *  Aufenthalt". Zusammengesetzt aus den Schlüsseln, die die Auswahlfelder im
 *  Editor schon nutzen (`chargeSingle`/`periodPerStay` …), damit keine zweite
 *  Übersetzung derselben Sache entsteht. */
export const FEE_BASIS_KEYS: Record<FeeBasis, readonly string[]> = {
  per_stay: ["pricingForm.chargeSingle", "pricingForm.periodPerStay"],
  per_night: ["pricingForm.chargeSingle", "pricingForm.periodPerNight"],
  per_guest_stay: ["pricingForm.chargePerPerson", "pricingForm.periodPerStay"],
  per_guest_night: ["pricingForm.chargePerPerson", "pricingForm.periodPerNight"],
  per_pet_stay: ["pricingForm.chargePerPet", "pricingForm.periodPerStay"],
};
/** Die beiden Achsen der Berechnung, wie sie im Formular als zwei Felder stehen.
 *  `PerPet` gibt es nur mit `PerStay` und nur an der Haustiergebühr — der
 *  Standard kennt keine Tier-pro-Nacht-Gebühr, der Server weist sie ab. */
export type FeeChargeBasis = "SingleCharge" | "PerPerson" | "PerPet";
export type FeePeriod = "PerStay" | "PerNight";
const FEE_BASIS_VON_ACHSEN: Record<string, FeeBasis> = {
  "SingleCharge|PerStay": "per_stay",
  "SingleCharge|PerNight": "per_night",
  "PerPerson|PerStay": "per_guest_stay",
  "PerPerson|PerNight": "per_guest_night",
  "PerPet|PerStay": "per_pet_stay",
  // Es gibt kein „pro Tier pro Nacht": die Kombination fällt auf pro Aufenthalt
  // zurück, statt einen Wert zu erzeugen, den der Server ablehnt.
  "PerPet|PerNight": "per_pet_stay",
};
/** Basis → die zwei Achsen (für die zwei Auswahlfelder). */
export function feeBasisAchsen(basis: FeeBasis): {
  charge: FeeChargeBasis;
  period: FeePeriod;
} {
  if (basis === "per_pet_stay") return { charge: "PerPet", period: "PerStay" };
  return {
    charge: basis.startsWith("per_guest") ? "PerPerson" : "SingleCharge",
    period: basis.endsWith("night") ? "PerNight" : "PerStay",
  };
}
/** Die zwei Achsen → Basis. */
export function feeBasisAus(charge: FeeChargeBasis, period: FeePeriod): FeeBasis {
  return FEE_BASIS_VON_ACHSEN[`${charge}|${period}`];
}
/** Airbnb-Kategorien, für die „pro Tier" wählbar ist. Gegenstück:
 *  PET_BASIS_CATEGORIES in properties/gebuehren.py. */
export const PET_BASIS_CATEGORIES = ["pet"];

/** Pauschalbetrag oder Prozentsatz. Prozent ist IMMER einmalig auf den
 *  Zimmerpreis (einschließlich Aktionen) — die Berechnungsfelder entfallen dann. */
export type FeeMode = "amount" | "percent";

// Gebührenart. Bestimmt, als WAS die Gebühr beim Portal ankommt — Airbnb kennt
// z. B. Reinigung und Haustier als eigene Kategorien, nicht als Freitext.
// Die Liste ist eine Fachtaxonomie mit 51 Einträgen und kommt deshalb LIVE vom
// Server (`GET /properties/fee-types`, eine Quelle: gebuehren.FEE_TYPE_CATEGORY),
// statt hier als zweite Wahrheit zu liegen.
export type FeeType = string;
export type FeeTypeEntry = { value: FeeType; label: string; category: string | null };

/** Airbnb-Gebührenkategorien, auf die eine Steuer erhoben werden kann.
 *  Gegenstück: TAXABLE_BASE_CATEGORIES in properties/gebuehren.py. */
export const TAXABLE_BASE_CATEGORIES = [
  "cleaning",
  "linen",
  "resort",
  "management",
  "community",
  "pet",
] as const;

export type Fee = {
  id: string;
  /** Interner Name (Fallback, wenn keine gastseitige Übersetzung greift). */
  name: string;
  /** Gastseitiger Name je Sprache — dieselbe Achse wie bei der lokalen Steuer.
   *  Die Gebühr steht in der Preisaufschlüsselung des Gastes; ohne Übersetzung
   *  liest ein dänischer Gast „Reinigungsgebühr". */
  names?: Record<string, string>;
  amount: number;
  /** Pauschalbetrag (Standard) oder Prozentsatz auf den Zimmerpreis. */
  mode?: FeeMode;
  basis: FeeBasis;
  optional: boolean; // Gast kann ab-/zuwählen
  // Eigener USt-Satz in % (z. B. Frühstück 19 % neben Logis 7 %). Leer =
  // Standard-Übernachtungssatz des Objekts/Kontos (Override-Hierarchie).
  taxRate?: number | null;
  /** Steckt `taxRate` schon in `amount` (Brutto) oder kommt er obendrauf?
   *  Fehlend/`true` = enthalten — das bisherige Verhalten, damit Bestandsgebühren
   *  nicht stillschweigend teurer werden. Nur wirksam mit eigenem `taxRate`. */
  taxIncluded?: boolean;
  /** Gebühr nur bei Kurzaufenthalten erheben. „Kurz" ist die EINE Grenze des
   *  Objekts (`shortStayMaxNights`), keine zweite Zahl an der Gebühr. Ohne
   *  gepflegte Grenze greift die Gebühr nicht — und an kein Portal geht sie
   *  ohnehin, weil dort keine Längenbedingung abbildbar ist. */
  shortStayOnly?: boolean;
  // Gebührenart für die Portale. Altbestand hat sie nicht — dann geht die
  // Gebühr an kein Portal (kein erfundener Typ, Wurzel 4).
  feeType?: FeeType;
  /** Interne Beschreibung; serverseitig beim Speichern sanitisiert. */
  descriptionHtml?: string | null;
  /** Gültigkeit nach ANREISE (ISO-Datum, beide inklusiv, je optional). Anlass:
   *  eine Gebühr, die es erst seit einem Datum gibt, darf die Abrechnung für
   *  frühere Aufenthalte nicht nachtragen. An die Portale geht eine Gebühr mit
   *  Zeitraum nicht (keine Datumsbedingung bei Channex). */
  validFrom?: string | null;
  validUntil?: string | null;
  /** Nur in der Eigentümer-Abrechnung: dem Gast nirgends berechnet, an kein
   *  Portal gesendet — eine interne Abrechnungsgröße. */
  ownerStatementOnly?: boolean;
  // Kanal-Einschränkung: leer/fehlend = alle Kanäle. Sonst NUR diese Kanäle —
  // Portal-Codes (rate_plans.portal_scope) UND die eigenen Buchungsstrecken
  // ("direct" = Website, "portal" = myBestDays).
  portalScope?: string[];
};

// Steuer (Taxes): USt./Sales tax ODER lokale Steuer.
export type TaxKind = "vat" | "local";
export type TaxMode = "percent" | "amount";
/** i18n-Schlüssel je Steuerart (statt deutscher Klartexte, siehe
 *  `FEE_BASIS_KEYS`). Beide Schlüssel gibt es in allen 24 Sprachen. */
export const TAX_KIND_KEYS: Record<TaxKind, string> = {
  vat: "pricingForm.vatLabel",
  local: "pricingForm.localTaxLabel",
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
  /** Nur bei mode==="percent": Werte aus TAXABLE_BASE_ITEMS (Grundpreis und/oder
   *  Gebührenkategorien). Alte Datensätze trugen hier Fee-IDs; der Server hebt
   *  sie beim nächsten Speichern auf ihre Kategorie. */
  taxableBase?: string[];
  includedInPrice: boolean; // im Preis enthalten?
  /** Kanal-Einschränkung: leer/fehlend = alle Kanäle. Sonst NUR diese Portale.
   *  Nötig, wo das Portal die Steuer selbst einzieht (Airbnb „collects taxes",
   *  Booking in manchen Regionen) — sonst zahlt der Gast doppelt. */
  portalScope?: string[];
};

/** Bemessungsgrundlage einer prozentualen lokalen Steuer: Grundpreis und/oder
 *  Gebührenkategorien. Die Auswahl wirkt NUR auf das, was an Airbnb geht — für
 *  alle anderen Kanäle (auch die eigene Buchungsstrecke) gelten Steuern nur auf
 *  den Basispreis. Gegenstück: TAXABLE_BASE_ITEMS in properties/gebuehren.py. */
export const TAXABLE_BASE_ITEMS: readonly string[] = [
  TAXABLE_BASE_PRICE,
  ...TAXABLE_BASE_CATEGORIES,
];

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

/** Dasselbe für eine Gebühr. Die Liste zeigt den Namen, den der GAST sieht —
 *  sonst prüft der Betrieb die Übersetzung nie und merkt erst am Gast-Angebot,
 *  dass dort noch der interne Arbeitstitel steht. */
export function feeDisplayName(fee: Fee, locale: string): string {
  return fee.names?.[locale]?.trim() || fee.name;
}

// Promotions liegen NICHT hier, sondern als eigene Zeilen in
// `property_discounts` (lib/promotions.ts). Der frühere Blob-Eintrag trug ein
// FREITEXT-Feld „conditions", das niemand auswertete: „20 % nur Juni" zog 20 %
// von JEDER Buchung ab. Der Preis-Resolver liest den Blob deshalb nicht mehr,
// und die Oberfläche pflegt ihn nicht mehr — ein Feld, das nur noch aussieht
// wie eine Preisregel, wäre schlimmer als keines.

// Extras (Zusatzleistungen) liegen NICHT hier, sondern als eigene Zeilen in
// `property_addons` (lib/addons.ts, Migrationen 0074/0075). Der frühere
// Blob-Eintrag `addOns` war eine Attrappe: NIEMAND hat ihn gelesen — nicht der
// Preis-Resolver, nicht die Buchungsstrecke, nicht die Rechnung. Der Betrieb
// pflegte Extras auf der Preise-Seite, und im Gast-Angebot tauchten sie nie auf.
// Dasselbe Muster wie bei den Promotions davor, deshalb dieselbe Lösung: die
// Seite pflegt jetzt den echten Katalog, und das Blob-Feld ist weg statt weiter
// wie ein Preisbestandteil auszusehen.

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
