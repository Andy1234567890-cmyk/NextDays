// Typen des Bereichs »belege« (Buchhaltung → Belege). camelCase, weil das
// Backend (bereiche/belege/schemas.py, alias_generator=to_camel) so antwortet.
// Die Literale entsprechen den CHECKs in 0660/0661.

export type Belegart =
  | "quote"
  | "order_confirmation"
  | "delivery_note"
  | "invoice"
  | "credit_note"
  | "storno"
  | "recurring";

/** Reihenfolge der Kette — so stehen die Tabs. */
export const BELEGARTEN: readonly Belegart[] = [
  "quote",
  "order_confirmation",
  "delivery_note",
  "invoice",
  "credit_note",
  "storno",
  "recurring",
] as const;

/** Was der EINE Editor direkt anlegen darf (Storno nur über die Rechnung,
 *  Vorlagen nur aus einer Rechnung). */
export const EDITOR_BELEGARTEN: readonly Belegart[] = [
  "invoice",
  "order_confirmation",
  "delivery_note",
  "credit_note",
] as const;

export type Zielart = "order_confirmation" | "delivery_note" | "invoice" | "credit_note";

/** Erlaubte Umwandlungen (identisch zu `KETTE` im Service). */
export const KETTE: Readonly<Partial<Record<Belegart, readonly Zielart[]>>> = {
  quote: ["order_confirmation", "invoice"],
  order_confirmation: ["delivery_note", "invoice"],
  delivery_note: ["invoice"],
  invoice: ["credit_note"],
};

/** Präfix des Nummernkreises je Art (Anzeige; gezogen wird serverseitig). */
export const NUMMERNKREIS_PRAEFIX: Readonly<Record<Belegart, string>> = {
  quote: "AN-",
  order_confirmation: "AB-",
  delivery_note: "LS-",
  invoice: "RE-",
  credit_note: "GU-",
  storno: "ST-",
  recurring: "—",
};

export type RecurringInterval = "weekly" | "monthly" | "quarterly" | "yearly";
export type RecurringStatus = "active" | "paused" | "completed";

export type BelegPosition = {
  id: string | null;
  position: number;
  description: string;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  taxRate: string;
  discountPercent: string;
  netAmount: string;
  taxAmount: string;
  grossAmount: string;
  sku: string | null;
};

export type BelegListItem = {
  id: string;
  type: Belegart;
  number: string | null;
  status: string;
  customerId: string | null;
  customerName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  netAmount: string;
  taxAmount: string;
  grossAmount: string;
  isLocked: boolean;
  sourceDocumentId: string | null;
  sourceQuoteId: string | null;
  convertedInvoiceId: string | null;
  isRecurringTemplate: boolean;
  recurringInterval: RecurringInterval | null;
  recurringStatus: RecurringStatus | null;
  recurringNextAt: string | null;
  recurringEndAt: string | null;
  recurringTemplateId: string | null;
  recurringPeriodStart: string | null;
  createdAt: string;
};

export type BelegDerived = {
  id: string;
  type: Belegart;
  number: string | null;
  status: string;
};

export type Beleg = BelegListItem & {
  taxRule: string | null;
  headText: string | null;
  footerText: string | null;
  notes: string | null;
  language: string | null;
  items: BelegPosition[];
  derived: BelegDerived[];
};

export type BelegListe = { items: BelegListItem[]; total: number; type: Belegart };

export type RecurringRunResult = {
  created: number;
  skipped: number;
  completed: number;
  createdIds: string[];
};

export type RecurringCreateInput = {
  interval: RecurringInterval;
  startAt: string; // YYYY-MM-DD
  endAt?: string | null;
};

export type RecurringUpdateInput = {
  status?: RecurringStatus;
  interval?: RecurringInterval;
  nextAt?: string;
  endAt?: string;
};

export function istBelegart(wert: string | undefined | null): wert is Belegart {
  return !!wert && (BELEGARTEN as readonly string[]).includes(wert);
}
