// Typen des Bereichs Buchhaltung → Ausgaben. Der Backend-Bereich
// (apps/api/.../bereiche/ausgaben) antwortet camelCase (alias_generator);
// die Namen hier sind 1:1 die Antwortfelder. Beträge kommen als String
// (Decimal) — nie in Number rechnen, nur anzeigen.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type PaymentStatus = "open" | "paid" | "cancelled";
export type RecurringInterval = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type CategoryKind = "einkauf" | "betrieb" | "personal" | "steuern" | "sonstiges";
export type ExpenseSource = "manual" | "xrechnung" | "ocr" | "recurring";

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["open", "paid", "cancelled"];
export const RECURRING_INTERVALS: readonly RecurringInterval[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];
export const CATEGORY_KINDS: readonly CategoryKind[] = [
  "einkauf",
  "betrieb",
  "personal",
  "steuern",
  "sonstiges",
];

export type ExpenseCategory = {
  id: string;
  tenantId: string;
  name: string;
  kind: CategoryKind;
  bookingAccount: string | null;
  color: string | null;
  abbreviation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  tenantId: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierVatId: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  title: string;
  description: string | null;
  receiptNumber: string | null;
  expenseDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
  netAmount: string;
  taxAmount: string;
  grossAmount: string;
  taxRate: string;
  currency: string;
  taxDeductible: boolean | null;
  categoryId: string | null;
  categoryName: string | null;
  bookingAccount: string | null;
  costCenter: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paidAt: string | null;
  isRecurring: boolean;
  recurringInterval: RecurringInterval | null;
  nextDueDate: string | null;
  templateId: string | null;
  hasReceipt: boolean;
  receiptFilename: string | null;
  receiptMime: string | null;
  receiptSizeBytes: number | null;
  ocrRaw: Record<string, unknown> | null;
  isLocked: boolean;
  lockedAt: string | null;
  notes: string | null;
  source: ExpenseSource;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseList = {
  items: Expense[];
  total: number;
  sumGrossByCurrency: Record<string, string>;
};

export type ExpenseFilter = {
  from?: string;
  to?: string;
  status?: PaymentStatus;
  categoryId?: string;
  recurring?: boolean;
  search?: string;
  limit?: number;
};

/** Body für POST/PATCH — Beträge als String, der Server rechnet (Decimal).
 *  `taxRate` ist beim Anlegen Pflicht (kein Standardsatz, Wurzel 4). */
export type ExpenseInput = {
  title: string;
  description?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierAddress?: string | null;
  supplierVatId?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  receiptNumber?: string | null;
  expenseDate: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  grossAmount?: string | null;
  netAmount?: string | null;
  taxAmount?: string | null;
  taxRate: string;
  currency?: string | null;
  taxDeductible?: boolean | null;
  categoryId?: string | null;
  bookingAccount?: string | null;
  costCenter?: string | null;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string | null;
  paidAt?: string | null;
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval | null;
  nextDueDate?: string | null;
  notes?: string | null;
  ocrRaw?: Record<string, unknown> | null;
  source?: ExpenseSource;
};

export type ExpenseUpdateInput = Partial<ExpenseInput>;

export type ExpenseCategoryInput = {
  name: string;
  kind: CategoryKind;
  bookingAccount?: string | null;
  color?: string | null;
  abbreviation?: string | null;
  isActive?: boolean;
};

export type ReceiptUrl = {
  url: string;
  filename: string | null;
  mime: string | null;
  expiresInSeconds: number;
};

export type RecurringRunResult = {
  templatesChecked: number;
  created: number;
  skippedExisting: number;
  createdIds: string[];
};

/** Vorschläge des Belegauslesers — nichts davon ist gespeichert. */
export type ReceiptExtraction = {
  supplierName: string | null;
  supplierAddress: string | null;
  supplierVatId: string | null;
  supplierEmail: string | null;
  receiptNumber: string | null;
  expenseDate: string | null;
  dueDate: string | null;
  netAmount: string | null;
  taxAmount: string | null;
  grossAmount: string | null;
  taxRate: string | null;
  currency: string | null;
  iban: string | null;
  description: string | null;
  confidence: "hoch" | "mittel" | "niedrig" | null;
  raw: Record<string, unknown>;
};
