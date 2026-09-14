// Typen des Bereichs Buchhaltung → Steuer (Antworten des FastAPI-Bereichs
// `bereiche/steuer`, camelCase wie dort per alias_generator). Beträge kommen
// als Strings (Decimal) — die Anzeige rechnet nicht, sie formatiert.

export type PeriodKind = "month" | "quarter" | "year";
export type ReturnStatus = "draft" | "submitted" | "corrected";

export type SalesCategory =
  | "taxable"
  | "exempt"
  | "reverse_charge_domestic"
  | "reverse_charge_eu"
  | "intra_community_supply"
  | "export"
  | "out_of_scope"
  | "oss"
  | "undetermined";

export type SalesLine = {
  category: SalesCategory;
  taxRate: string | null;
  net: string;
  tax: string;
  invoiceCount: number;
};

export type InputTaxLine = {
  taxRate: string | null;
  net: string;
  tax: string;
  expenseCount: number;
};

export type MappedFigure = {
  code: string;
  label: string;
  amount: string;
  kind: "net" | "tax" | "result";
  source: string;
};

export type VatReturn = {
  period: string;
  periodKind: PeriodKind;
  periodStart: string;
  periodEnd: string;
  country: string;
  currency: string;
  smallBusiness: boolean;
  sales: SalesLine[];
  inputTax: InputTaxLine[];
  salesNetTotal: string;
  salesTaxTotal: string;
  inputTaxTotal: string;
  payable: string;
  mappingScheme: string | null;
  mapping: MappedFigure[];
  warnings: string[];
  frozenVersion: number | null;
};

export type TaxReturn = {
  id: string;
  period: string;
  periodKind: PeriodKind;
  periodStart: string;
  periodEnd: string;
  version: number;
  status: ReturnStatus;
  country: string;
  currency: string;
  smallBusiness: boolean;
  values: Record<string, unknown>;
  mapping: Record<string, unknown>;
  salesNetTotal: string;
  salesTaxTotal: string;
  inputTaxTotal: string;
  payable: string;
  submittedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxReturnList = { items: TaxReturn[]; total: number };

export type ProfitMonth = {
  month: number;
  incomeNet: string;
  expensesNet: string;
  profit: string;
  cumulativeProfit: string;
  estimatedTax: string | null;
};

export type ProfitEstimate = {
  year: number;
  currency: string;
  months: ProfitMonth[];
  incomeNetTotal: string;
  expensesNetTotal: string;
  profitTotal: string;
  estimatedTaxTotal: string | null;
  estimatedReserve: string | null;
  taxRateTotal: string | null;
  settingsComplete: boolean;
  warnings: string[];
};

export type TaxSettings = {
  incomeTaxRate: string | null;
  tradeTaxRate: string | null;
  vatPeriod: PeriodKind | null;
  reserveRate: string | null;
  note: string | null;
  country: string | null;
  currency: string | null;
  smallBusiness: boolean;
  configured: boolean;
  updatedAt: string | null;
};

export type TaxSettingsInput = {
  incomeTaxRate: string | null;
  tradeTaxRate: string | null;
  vatPeriod: PeriodKind | null;
  reserveRate: string | null;
  note: string | null;
};

export type SteuerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };
