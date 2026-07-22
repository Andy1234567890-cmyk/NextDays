// GoBD-Festschreibung Types für Taskilo
// Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern

export interface GoBDLockStatus {
  isLocked: boolean;
  lockedAt?: Date;
  lockedBy?: string; // User ID
  lockReason?: 'auto' | 'manual' | 'datev-export' | 'period-end';
  lockPeriod?: string; // Format: "2025-10" für Oktober 2025
  auditTrail?: GoBDAuditEntry[];
}

export interface GoBDAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'locked' | 'unlocked' | 'exported' | 'storno' | 'credit-note';
  documentId: string;
  documentType: 'invoice' | 'quote' | 'delivery' | 'credit-note' | 'cancellation';
  reason?: string;
  metadata?: Record<string, any>;
}

export interface GoBDDocument {
  id: string;
  documentNumber: string;
  documentType: 'invoice' | 'quote' | 'delivery' | 'credit-note' | 'cancellation';
  createdAt: Date;
  amount: number;
  // Belegwährung (Wurzel 4: kein hartes EUR in der Anzeige). Optional, solange
  // nicht jeder Erzeuger sie liefert — die Anzeige rendert dann symbollos.
  currency?: string;
  customerId: string;
  companyId: string;
  gobdStatus: GoBDLockStatus;
  // Storno/Gutschrift Referenzen
  originalDocumentId?: string; // Bei Storno/Gutschrift
  stornoDocumentId?: string; // Verweis auf Storno
  creditNoteId?: string; // Verweis auf Gutschrift
}

export interface GoBDPeriodLock {
  id: string;
  companyId: string;
  period: string; // "2025-10"
  lockedAt: Date;
  lockedBy: string;
  documentCount: number;
  totalAmount: number;
  documentTypes: Record<string, number>;
  auditTrail: GoBDAuditEntry[];
}

export interface GoBDSettings {
  companyId: string;
  autoLockOnSend: boolean; // Automatische Festschreibung bei Versand
  autoLockOnExport: boolean; // Automatische Festschreibung bei DATEV-Export
  lockDeadlineDays: number; // Tage bis Deadline (Standard: 30)
  allowStornoAfterLock: boolean; // Storno nach Festschreibung erlauben
  requireApprovalForUnlock: boolean; // Freigabe für Entsperrung erforderlich
  notificationSettings: {
    lockDeadlineReminder: boolean;
    lockConfirmation: boolean;
    stornoNotification: boolean;
  };
}

export interface GoBDComplianceReport {
  companyId: string;
  period: string;
  generatedAt: Date;
  status: 'compliant' | 'warning' | 'non-compliant';
  summary: {
    totalDocuments: number;
    lockedDocuments: number;
    unlockedDocuments: number;
    overdueDocuments: number;
    stornoDocuments: number;
  };
  issues: GoBDComplianceIssue[];
  recommendations: string[];
}

export interface GoBDComplianceIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'missing-lock' | 'overdue-lock' | 'invalid-storno' | 'audit-trail-gap';
  message: string;
  documentIds: string[];
  resolution?: string;
}

// Storno/Gutschrift Types
export interface StornoRequest {
  originalDocumentId: string;
  reason: string;
  stornoDate: Date;
  partialAmount?: number; // Für Teilstorno
  items?: StornoItem[]; // Für positionsweises Storno
}

export interface StornoItem {
  originalItemId: string;
  quantity: number;
  reason: string;
}

export interface CreditNoteRequest {
  originalDocumentId: string;
  reason: string;
  creditAmount: number;
  creditDate: Date;
  items?: CreditNoteItem[];
}

export interface CreditNoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}
