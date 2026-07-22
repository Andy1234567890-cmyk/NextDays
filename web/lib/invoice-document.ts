// Mapper: FastAPI-InvoiceResponse (snake_case, GET /buchhaltung/invoices/{id})
// → Dokument-Form des Buchhaltungs-Bestands (camelCase, SendDocumentModal/
// PDF-Templates). Wird vom Kalender-Slider („Ansehen & versenden") und vom
// SendDocumentModal-Nachladepfad genutzt — EINE Übersetzung, keine zwei.
// Bewusst OHNE "use server": reine, synchron nutzbare Funktionen/Typen.

export type BackendInvoiceItem = {
  id: string;
  position: number;
  description: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  tax_rate: number | string;
  discount_percent?: number | string;
  net_amount: number | string;
  tax_amount: number | string;
  gross_amount: number | string;
};

export type BackendInvoice = {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  invoice_number?: string | null;
  invoice_type: string;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  currency: string;
  net_amount: number | string;
  tax_amount: number | string;
  gross_amount: number | string;
  paid_amount: number | string;
  tax_rule?: string | null;
  is_kleinunternehmer: boolean;
  head_text?: string | null;
  footer_text?: string | null;
  notes?: string | null;
  gobd_status?: string;
  is_locked?: boolean;
  // Dokumentsprache (0099, Gastsprache); null = Bestand → de.
  language?: string | null;
  created_at: string;
  updated_at: string;
  items: BackendInvoiceItem[];
};

/** Zahl aus FastAPI-Numeric (kommt je nach Serialisierung als string). */
function num(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type InvoiceDocumentExtras = {
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
};

/**
 * Backend-Rechnung in die Dokument-Form des SendDocumentModal übersetzen.
 * Empfängerdaten (Name/E-Mail/Adresse) speichert das Backend nicht am Beleg —
 * sie kommen als `extras` vom Aufrufer (z. B. Gastdaten aus dem Kalender).
 */
export function invoiceToDocument(inv: BackendInvoice, extras: InvoiceDocumentExtras = {}) {
  const number = inv.invoice_number || "";
  return {
    id: inv.id,
    number,
    invoiceNumber: number,
    documentNumber: number,
    sequentialNumber: 0,
    date: inv.issue_date || "",
    issueDate: inv.issue_date || "",
    dueDate: inv.due_date || "",
    status: inv.status,
    currency: inv.currency,
    customerName: extras.customerName || "",
    customerEmail: extras.customerEmail || "",
    customerAddress: extras.customerAddress || "",
    headTextHtml: inv.head_text || "",
    footerText: inv.footer_text || "",
    notes: inv.notes || "",
    taxRule: inv.tax_rule || "DE_TAXABLE",
    taxRuleType: inv.tax_rule || "DE_TAXABLE",
    isSmallBusiness: !!inv.is_kleinunternehmer,
    amount: num(inv.net_amount),
    tax: num(inv.tax_amount),
    total: num(inv.gross_amount),
    // Dokumentsprache des Belegs — belegt die Sprach-Auswahl im Dialog vor.
    language: inv.language || undefined,
    items: (inv.items || []).map((it) => ({
      id: it.id,
      description: it.description,
      quantity: num(it.quantity),
      unitPrice: num(it.unit_price),
      total: num(it.gross_amount),
      taxRate: num(it.tax_rate),
      unit: it.unit,
      discountPercent: num(it.discount_percent),
    })),
  };
}

export type InvoiceDocument = ReturnType<typeof invoiceToDocument>;
