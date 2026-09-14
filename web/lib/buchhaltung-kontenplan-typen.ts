// Typen des Bereichs Kontenplan (Buchhaltung): Buchungskonten, Kostenstellen,
// Nummernkreise, Zahlungsarten. Form = camelCase-Antwort des Backends
// (apps/api/src/features/buchhaltung/bereiche/kontenplan/schemas.py).
// Die Literale sind deckungsgleich mit den DB-Checks 0671/0673.

export type AccountType = "INCOME" | "EXPENSE" | "ASSET" | "LIABILITY";
export const ACCOUNT_TYPES: readonly AccountType[] = ["INCOME", "EXPENSE", "ASSET", "LIABILITY"];

export type Kontenrahmen = "SKR03" | "SKR04";

export type BookingAccount = {
  id: string;
  tenantId: string;
  number: string;
  name: string;
  type: AccountType;
  // Decimal kommt als String; leer = kein Satz festgelegt (kein Ersatzwert).
  taxRate: string | number | null;
  kontenrahmen: Kontenrahmen | null;
  skrReference: string | null;
  description: string | null;
  automaticBooking: boolean;
  isSystem: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BookingAccountInput = {
  number: string;
  name: string;
  type: AccountType;
  taxRate?: string | null;
  kontenrahmen?: Kontenrahmen | null;
  skrReference?: string | null;
  description?: string | null;
  automaticBooking?: boolean;
  active?: boolean;
};

export type ImportStandardResult = {
  kontenrahmen: Kontenrahmen;
  angelegt: number;
  uebersprungen: number;
  accounts: BookingAccount[];
};

export type CostCenter = {
  id: string;
  tenantId: string;
  number: string;
  name: string;
  description: string | null;
  propertyId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CostCenterInput = {
  number: string;
  name: string;
  description?: string | null;
  propertyId?: string | null;
  active?: boolean;
};

export type PaymentMethodType =
  | "bank_transfer"
  | "cash"
  | "card"
  | "paypal"
  | "direct_debit"
  | "other";
export const PAYMENT_METHOD_TYPES: readonly PaymentMethodType[] = [
  "bank_transfer",
  "cash",
  "card",
  "paypal",
  "direct_debit",
  "other",
];

export type PaymentMethod = {
  id: string;
  tenantId: string;
  name: string;
  type: PaymentMethodType;
  paymentTermDays: number | null;
  paymentAccountId: string | null;
  isDefault: boolean;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentMethodInput = {
  name: string;
  type: PaymentMethodType;
  paymentTermDays?: number | null;
  paymentAccountId?: string | null;
  isDefault?: boolean;
  active?: boolean;
  notes?: string | null;
};

/** Ein Nummernkreis, wie `GET /buchhaltung/number-sequences` (Bestand) ihn liefert. */
export type NumberSequence = {
  id: string | null;
  companyId: string;
  type: string;
  prefix: string;
  format: string;
  nextNumber: number;
  nextFormatted: string;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  // Nur in der PATCH-Antwort des Bereichs enthalten.
  startValue?: number;
  gezogen?: boolean;
};

export type NumberSequenceInput = {
  format?: string;
  prefix?: string;
  suffix?: string;
  padding?: number;
  nextNumber?: number;
};

export type CreateDefaultsResult = {
  angelegt: string[];
  sequences: NumberSequence[];
};
