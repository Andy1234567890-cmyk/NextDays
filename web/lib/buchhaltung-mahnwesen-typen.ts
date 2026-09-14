// Typen des Bereichs Mahnwesen — Spiegel der Pydantic-Schemas in
// apps/api/src/features/buchhaltung/bereiche/mahnwesen/schemas.py. Die API
// antwortet camelCase (alias_generator=to_camel), deshalb hier camelCase.

export type ReminderStatus = "draft" | "sent" | "paid" | "cancelled";
export type ReminderLevel = 1 | 2 | 3;

export type StufenEinstellung = {
  days: number;
  fee: string;
  title: string;
  text: string | null;
};

export type ReminderSettings = {
  level1: StufenEinstellung | null;
  level2: StufenEinstellung | null;
  level3: StufenEinstellung | null;
  interestRate: string | null;
  autoMarkOverdue: boolean | null;
  configured: boolean;
  updatedAt: string | null;
};

export type ReminderSettingsInput = {
  level1: StufenEinstellung;
  level2: StufenEinstellung;
  level3: StufenEinstellung;
  interestRate: string;
  autoMarkOverdue: boolean;
};

export type Reminder = {
  id: string;
  tenantId: string;
  reminderNumber: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  level: ReminderLevel;
  reminderDate: string;
  dueDate: string;
  invoiceDueDate: string | null;
  daysOverdue: number;
  fee: string;
  interest: string;
  interestRate: string;
  amountOpen: string;
  amountTotal: string;
  currency: string;
  status: ReminderStatus;
  sentAt: string | null;
  sentMessageId: string | null;
  textHeader: string | null;
  textFooter: string | null;
  notes: string | null;
  templateSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ReminderList = { items: Reminder[]; total: number };

export type OverdueInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  issueDate: string | null;
  dueDate: string;
  daysOverdue: number;
  grossAmount: string;
  paidAmount: string;
  amountOpen: string;
  currency: string;
  lastLevel: number;
  lastReminderId: string | null;
  lastReminderStatus: ReminderStatus | null;
  nextLevel: number | null;
};

export type ReminderCreateInput = {
  invoiceId: string;
  level?: ReminderLevel;
  reminderDate?: string;
  dueDate?: string;
  fee?: string;
  interestRate?: string;
  textHeader?: string;
  textFooter?: string;
  notes?: string;
};

export type ReminderUpdateInput = {
  textHeader?: string;
  textFooter?: string;
  notes?: string;
  dueDate?: string;
};

export type ReminderSendInput = {
  to: string[];
  subject: string;
  text: string;
  pdfBase64: string;
  filename?: string;
  kopieAnAbsender?: boolean;
};

export type SendResult = {
  id: string;
  status: ReminderStatus;
  sentAt: string;
  sentMessageId: string;
};

// Absenderdaten für den PDF-Kopf — Auszug aus GET /buchhaltung/companies/me.
export type FirmaKopf = {
  companyName: string;
  companyStreet: string;
  companyHouseNumber: string;
  companyPostalCode: string;
  companyCity: string;
  companyCountry: string;
  email: string;
  phoneNumber: string;
  vatId: string;
  iban: string;
  bic: string;
  bankName: string;
};
