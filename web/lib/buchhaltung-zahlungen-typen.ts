// Typen des Bereichs Buchhaltung → Zahlungen / Bank / Kassenbuch.
// Spiegel der Pydantic-Schemas in apps/api/.../bereiche/zahlungen/schemas.py
// (camelCase nach außen). Beträge kommen als Strings (Decimal) — nie in
// Number rechnen, nur zur Anzeige wandeln.

export type AccountType = "bank" | "cash" | "paypal" | "stripe" | "other";
export const ACCOUNT_TYPES: readonly AccountType[] = ["bank", "cash", "paypal", "stripe", "other"];

export type TransactionStatus = "unmatched" | "matched" | "ignored";
export type TransactionSource = "import" | "manual" | "opening";
export type DocumentType = "beleg" | "rechnung" | "gutschrift" | "INVOICE" | "EXPENSE" | "kassenbuch";
export type BookingStatus = "open" | "booked";

export type PaymentAccount = {
  id: string;
  tenantId: string;
  name: string;
  type: AccountType;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  currency: string;
  openingBalance: string;
  balance: string;
  transactionCount: number;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentAccountInput = {
  name: string;
  type: AccountType;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  currency?: string | null;
  openingBalance?: string;
  openingDate?: string | null;
  isDefault?: boolean;
};

export type PaymentAccountUpdate = {
  name?: string;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  isDefault?: boolean;
  active?: boolean;
};

export type LinkedDocument = {
  linkId: string;
  documentId: string;
  documentType: DocumentType;
  documentNumber: string;
  customerName: string;
  amountAllocated: string;
};

export type BankTransaction = {
  id: string;
  tenantId: string;
  paymentAccountId: string;
  paymentAccountName: string | null;
  importBatchId: string | null;
  bookingDate: string;
  valueDate: string | null;
  amount: string;
  currency: string;
  counterpartName: string | null;
  counterpartIban: string | null;
  counterpartBic: string | null;
  purpose: string | null;
  reference: string | null;
  transactionCode: string | null;
  source: TransactionSource;
  ignored: boolean;
  note: string | null;
  linkCount: number;
  linkedAmount: string;
  remainingAmount: string;
  status: TransactionStatus;
  linkedDocuments: LinkedDocument[];
  createdAt: string;
};

export type BankTransactionList = {
  items: BankTransaction[];
  total: number;
  sumIn: string;
  sumOut: string;
};

export type BankTransactionFilter = {
  accountId?: string;
  from?: string;
  to?: string;
  status?: TransactionStatus;
  search?: string;
  limit?: number;
};

export type BankTransactionInput = {
  paymentAccountId: string;
  bookingDate: string;
  valueDate?: string | null;
  amount: string;
  counterpartName?: string | null;
  purpose?: string | null;
  reference?: string | null;
  note?: string | null;
};

export type BankTransactionUpdate = {
  ignored?: boolean;
  note?: string | null;
};

export type CsvMapping = {
  date: number;
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  name?: number | null;
  purpose?: number | null;
  valueDate?: number | null;
  reference?: number | null;
  iban?: number | null;
  currency?: number | null;
};

export type CsvEncoding = "auto" | "utf-8" | "cp1252" | "latin-1";

export type CsvPreviewInput = {
  fileName: string;
  contentBase64: string;
  delimiter?: string | null;
  hasHeader?: boolean;
  encoding?: CsvEncoding;
};

export type CsvPreview = {
  delimiter: string;
  encoding: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  suggestedMapping: CsvMapping | null;
};

export type CsvImportInput = CsvPreviewInput & {
  paymentAccountId: string;
  mapping: CsvMapping;
  dateFormat?: string | null;
  decimalSeparator?: "auto" | "," | ".";
};

export type ImportResult = {
  batchId: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
};

export type BookingAccountRef = {
  id: string;
  number: string;
  name: string;
  type: string;
};

export type TransactionLinkInput = {
  transactionId: string;
  documentType: "INVOICE" | "EXPENSE";
  documentId: string;
  amountAllocated?: string | null;
  amountDifferenceReason?: string | null;
  bookingAccount?: BookingAccountRef | null;
};

export type TransactionLink = {
  id: string;
  tenantId: string;
  transactionId: string;
  documentId: string;
  documentType: DocumentType;
  invoiceId: string | null;
  expenseId: string | null;
  documentNumber: string;
  documentDate: string | null;
  documentAmount: string;
  customerName: string;
  currency: string;
  amountAllocated: string;
  amountDifference: string | null;
  amountDifferenceReason: string | null;
  bookingAccount: BookingAccountRef | null;
  bookingStatus: BookingStatus;
  bookedAt: string | null;
  linkDate: string;
  createdBy: string;
  invoicePaymentId: string | null;
  transactionData: Record<string, unknown>;
  documentData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Suggestion = {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  grossAmount: string;
  paidAmount: string;
  amountOpen: string;
  currency: string;
  status: string;
  score: number;
  reasons: string[];
};

export type CashbookEntry = {
  id: string;
  bookingDate: string;
  amount: string;
  counterpartName: string | null;
  purpose: string | null;
  reference: string | null;
  source: TransactionSource;
  linkCount: number;
  runningBalance: string;
  createdAt: string;
};

export type Cashbook = {
  account: PaymentAccount;
  month: string;
  openingBalance: string;
  entries: CashbookEntry[];
  sumIn: string;
  sumOut: string;
  closingBalance: string;
};

export type CashbookEntryInput = {
  paymentAccountId: string;
  bookingDate: string;
  amount: string;
  purpose: string;
  counterpartName?: string | null;
  reference?: string | null;
};

// Buchungskonto aus GET /booking-accounts/{company} des Bestands (Kontenplan).
export type BookingAccount = {
  id: string;
  number: string;
  name: string;
  type: string;
};

// Differenzgründe für den Zuordnen-Dialog — Schlüssel für i18n
// (`zahlungenZuordnen.reason.<key>`), gespeichert wird der Klartext.
export const DIFFERENCE_REASONS = [
  "skonto",
  "bankfee",
  "rounding",
  "partial",
  "overpayment",
  "other",
] as const;
export type DifferenceReasonKey = (typeof DIFFERENCE_REASONS)[number];
