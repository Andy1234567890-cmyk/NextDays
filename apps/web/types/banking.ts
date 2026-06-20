// Banking-related TypeScript interfaces and types

export interface BankAccount {
  id: string;
  accountName: string;
  iban: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  availableBalance: number;
  currency: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'LOAN';
  isDefault: boolean;
  lastUpdated?: string;
  isConnected?: boolean;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  purpose: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  bookingDate: string;
  valueDate: string;
  transactionCode?: string;
  transactionType: 'DEBIT' | 'CREDIT';
  category?: string;
  isReconciled: boolean;
  isPending: boolean;
}

// Erweiterte Transaction-Interface für Modal-Komponenten
export interface ModalTransaction {
  id: string;
  name: string;
  verwendungszweck: string;
  buchungstag: string;
  betrag: number;
  accountId: string;
  // Erweiterte Felder (optional für Kompatibilität)
  status?: 'processed' | 'pending' | 'failed' | 'duplicate' | 'adjustment' | 'linked';
  offen?: boolean;
  verknuepfungen?: string[];
  linkedInvoices?: Array<{
    documentId: string;
    documentNumber: string;
    customerName: string;
  }>;
  accountName?: string;
  category?: string;
  bookingStatus?: 'open' | 'booked';
  empfaengerBank?: string;
  empfaengerBic?: string;
  empfaengerIban?: string;
  transaktionsart?: string;
  sepaPurpose?: string;
  merchantCategory?: string;
  primanota?: string;
  labels?: string[];
  isDuplicate?: boolean;
  isAdjustment?: boolean;
  importDate?: string;
}

export interface BankConnection {
  id: string;
  bankName: string;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSync?: string;
  accountIds: string[];
  errorMessage?: string;
}

export interface BankImportSettings {
  automaticSync: boolean;
  syncFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
  categorizeTransactions: boolean;
  reconcileAutomatically: boolean;
}

export interface ReconciliationRule {
  id: string;
  name: string;
  description: string;
  conditions: ReconciliationCondition[];
  actions: ReconciliationAction[];
  isActive: boolean;
}

export interface ReconciliationCondition {
  field: 'amount' | 'purpose' | 'counterpartName' | 'transactionCode';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string | number;
}

export interface ReconciliationAction {
  type: 'SET_CATEGORY' | 'MARK_RECONCILED' | 'CREATE_INVOICE' | 'SKIP';
  value: string;
}

export interface BankingStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingTransactions: number;
  reconciledTransactions: number;
  currency: string;
}

// finAPI specific types
export interface FinAPIAccount {
  id: number;
  accountName: string;
  iban?: string;
  accountNumber: string;
  subAccountNumber?: string;
  accountHolderName?: string;
  accountHolderNames?: string[];
  accountCurrency: string;
  accountType: {
    id: number;
    name: string;
  };
  balance?: number;
  overdraft?: number;
  overdraftLimit?: number;
  availableFunds?: number;
  isNew: boolean;
  isSepaAccount: boolean;
  isMoneyTransferAccount: boolean;
  supportedOrders: string[];
  interfaces: FinAPIInterface[];
  bank: FinAPIBank;
  lastSuccessfulUpdate?: string;
  lastUpdateAttempt?: string;
}

export interface FinAPITransaction {
  id: number;
  parentId?: number;
  accountId: number;
  valueDate: string;
  bankBookingDate: string;
  finapiBookingDate: string;
  amount: number;
  purpose?: string;
  counterpartName?: string;
  counterpartAccountNumber?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  counterpartBankName?: string;
  mcCode?: string;
  typeCodeZka?: string;
  typeCodeSwift?: string;
  sepaPurposeCode?: string;
  primanota?: string;
  category?: FinAPICategory;
  labels?: FinAPILabel[];
  isPotentialDuplicate: boolean;
  isAdjustingEntry: boolean;
  isNew: boolean;
  importDate: string;
}

export interface FinAPIBank {
  id: number;
  name: string;
  blz: string;
  bic?: string;
  country: string;
  logoUrl?: string;
  interfaces: FinAPIInterface[];
}

export interface FinAPIInterface {
  interface: 'FINTS_SERVER' | 'WEB_SCRAPER' | 'XS2A';
  status: 'SUPPORTED' | 'DEPRECATED' | 'DISABLED';
  capabilities: string[];
  loginCredentials: FinAPILoginCredential[];
  properties: string[];
  lastCommunicationAttempt?: string;
  lastSuccessfulCommunication?: string;
}

export interface FinAPILoginCredential {
  label: string;
  isSecret: boolean;
  isVolatile: boolean;
}

export interface FinAPICategory {
  id: number;
  name: string;
  parentId?: number;
  parentName?: string;
  isCustom: boolean;
  children?: number[];
}

export interface FinAPILabel {
  id: number;
  name: string;
}

export interface FinAPIBankConnection {
  id: number;
  bankId: number;
  name?: string;
  bankingUserId?: string;
  bankingCustomerId?: string;
  bankingPin?: string;
  type: 'ONLINE' | 'DEMO';
  updateStatus: 'IN_PROGRESS' | 'FINISHED';
  categorizationStatus: 'IN_PROGRESS' | 'FINISHED';
  lastManualUpdate?: FinAPIUpdateResult;
  lastAutoUpdate?: FinAPIUpdateResult;
  ibanOnlyMoneyTransferSupported: boolean;
  ibanOnlyDirectDebitSupported: boolean;
  collectiveMoneyTransferSupported: boolean;
  defaultTwoStepProcedureId?: string;
  twoStepProcedures: FinAPITwoStepProcedure[];
  interfaces: FinAPIInterface[];
  accountIds: number[];
  owners?: FinAPIBankConnectionOwner[];
  bank: FinAPIBank;
}

export interface FinAPIUpdateResult {
  result:
    | 'SUCCESSFUL'
    | 'BANK_SERVER_REJECTION'
    | 'INTERNAL_SERVER_ERROR'
    | 'INCORRECT_CREDENTIALS'
    | 'UNSUPPORTED_ORDER'
    | 'USER_ACTION_REQUIRED';
  errorMessage?: string;
  errorType?: string;
  timestamp: string;
}

export interface FinAPITwoStepProcedure {
  procedureId: string;
  procedureName: string;
  procedureChallengeType: string;
  implicitExecute: boolean;
}

export interface FinAPIBankConnectionOwner {
  firstName?: string;
  lastName?: string;
  salutation?: string;
  title?: string;
  email?: string;
  dateOfBirth?: string;
  postCode?: string;
  country?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
}
