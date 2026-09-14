// Typen des Bereichs »kontakte« (Buchhaltung): gespiegelt aus
// apps/api/src/features/buchhaltung/bereiche/kontakte/schemas.py.
// Das Backend antwortet camelCase (alias_generator=to_camel); der Kunden-
// Bestand (`/customers`) antwortet snake_case — deshalb zwei Schreibweisen.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/** Kundenzeile aus dem Bestand (`GET /customers/{id}`, snake_case). */
export type KundeDetail = {
  id: string;
  tenant_id: string;
  customer_number: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  vat_id: string | null;
  tax_number: string | null;
  is_supplier: boolean;
  customer_type: string;
  address: {
    text?: string;
    street?: string;
    house_number?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  } | null;
  default_payment_days: number | null;
  credit_limit: string | number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Lieferant = Kundenzeile mit is_supplier (Liste `GET /suppliers`). */
export type Lieferant = Pick<
  KundeDetail,
  "id" | "name" | "customer_number" | "email" | "phone" | "vat_id" | "customer_type" | "is_supplier"
>;

export type Ansprechpartner = {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnsprechpartnerEingabe = {
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
};

export type AdressArt = "billing" | "shipping" | "other";
export const ADRESS_ARTEN: readonly AdressArt[] = ["billing", "shipping", "other"];

export type Anschrift = {
  id: string;
  tenantId: string;
  customerId: string;
  type: AdressArt;
  label: string | null;
  recipient: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnschriftEingabe = {
  type: AdressArt;
  label?: string | null;
  recipient?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country: string;
  isDefault?: boolean;
};

export type Notiz = {
  id: string;
  tenantId: string;
  customerId: string;
  text: string;
  tags: string[];
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotizEingabe = {
  text: string;
  tags?: string[];
};

export type WaehrungsKennzahlen = {
  currency: string;
  revenueTotal: string;
  openAmount: string;
  overdueAmount: string;
  invoiceCount: number;
  openCount: number;
  overdueCount: number;
};

export type UebersichtBeleg = {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  grossAmount: string;
  paidAmount: string;
  openAmount: string;
  currency: string;
  isOverdue: boolean;
  createdAt: string | null;
};

export type KundenUebersicht = {
  customerId: string;
  byCurrency: WaehrungsKennzahlen[];
  invoiceCount: number;
  lastInvoiceDate: string | null;
  lastInvoiceNumber: string | null;
  truncated: boolean;
  contactCount: number;
  addressCount: number;
  noteCount: number;
  tags: string[];
  invoices: UebersichtBeleg[];
};
