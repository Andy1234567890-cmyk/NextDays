// Typen des Bereichs E-Rechnung (Buchhaltung → E-Rechnung). Spiegel der
// Pydantic-Antworten in apps/api/.../bereiche/erechnung/schemas.py (camelCase).
// Getrennt von der "use server"-Datei, die AUSSCHLIESSLICH async functions
// exportieren darf.

export type EInvoiceFormat = "xrechnung_ubl" | "xrechnung_cii" | "zugferd_en16931";
export const EINVOICE_FORMATE: readonly EInvoiceFormat[] = [
  "xrechnung_ubl",
  "xrechnung_cii",
  "zugferd_en16931",
];
export type ValidationStatus = "valid" | "invalid" | "unchecked";
export type TransmissionChannel = "email" | "peppol_manuell" | "download";
export type TransmissionStatus = "pending" | "sent" | "failed" | "downloaded";

export type Finding = {
  code: string;
  severity: "error" | "warning";
  bt: string | null;
  message: string;
};

export type Transmission = {
  id: string;
  eInvoiceId: string;
  channel: TransmissionChannel;
  recipient: string | null;
  status: TransmissionStatus;
  transmittedAt: string;
  messageId: string | null;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type EInvoice = {
  id: string;
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  format: EInvoiceFormat;
  validationStatus: ValidationStatus;
  findings: Finding[];
  xmlSha256: string;
  xmlBytes: number;
  version: number;
  downloadPath: string;
  generatedAt: string;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transmissions: Transmission[];
};

export type EInvoiceCreateInput = {
  invoiceId: string;
  format: EInvoiceFormat;
  xmlBase64: string;
};

export type TransmissionInput = {
  channel: TransmissionChannel;
  recipient?: string | null;
  status: TransmissionStatus;
  messageId?: string | null;
  error?: string | null;
};

export type CustomerGap = {
  customerId: string;
  customerName: string;
  missingEmail: boolean;
  missingLeitwegId: boolean;
  invoiceCount: number;
};

export type Compliance = {
  fromDate: string;
  toDate: string;
  invoicesTotal: number;
  withValidEinvoice: number;
  withInvalidEinvoice: number;
  withoutEinvoice: number;
  validSharePercent: number | null;
  customerGaps: CustomerGap[];
  mandatoryFrom: string | null;
};

export type EInvoiceSettings = {
  defaultFormat: EInvoiceFormat | null;
  leitwegId: string | null;
  mandatoryFrom: string | null;
  country: string | null;
  configured: boolean;
  updatedAt: string | null;
};

export type EInvoiceSettingsInput = {
  defaultFormat: EInvoiceFormat;
  leitwegId: string | null;
  mandatoryFrom: string | null;
};
