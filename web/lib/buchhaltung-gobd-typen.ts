// Typen des Bereichs GoBD — Spiegel der Pydantic-Schemas in
// apps/api/src/features/buchhaltung/bereiche/gobd/schemas.py. Die API
// antwortet camelCase (alias_generator=to_camel), deshalb hier camelCase.

export type AutoLockMode = "on_send" | "after_days" | "manual";
export type AuditAction = "lock" | "unlock_denied" | "storno" | "export" | "change";
export type AuditObjectType = "invoice" | "settings" | "export" | "audit_log";

export type GobdSettings = {
  companyId: string;
  autoLockMode: AutoLockMode;
  lockAfterDays: number | null;
  retentionYears: number | null;
  auditLogEnabled: boolean;
  autoLockOnExport: boolean;
  allowStornoAfterLock: boolean;
  requireApprovalForUnlock: boolean;
  notificationSettings: Record<string, boolean>;
  // Bestandsnamen (web/types/gobdTypes.ts), abgeleitet.
  autoLockOnSend: boolean;
  lockDeadlineDays: number | null;
  configured: boolean;
  updatedAt: string | null;
};

export type GobdSettingsInput = {
  autoLockMode?: AutoLockMode;
  lockAfterDays?: number;
  retentionYears?: number;
  auditLogEnabled?: boolean;
  autoLockOnExport?: boolean;
  allowStornoAfterLock?: boolean;
  requireApprovalForUnlock?: boolean;
  notificationSettings?: Record<string, boolean>;
};

export type LockResult = {
  locked: string[];
  alreadyLocked: string[];
  lockedAt: string | null;
  success: boolean;
  message: string | null;
};

export type AutoLockRunResult = {
  mode: AutoLockMode;
  candidates: number;
  locked: string[];
  lockedAt: string | null;
};

export type OffeneRechnung = {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  status: string;
  issueDate: string | null;
  grossAmount: string;
  currency: string;
  customerName: string | null;
};

export type GobdStatus = {
  drafts: number;
  open: number;
  locked: number;
  storno: number;
  lastLockedAt: string | null;
  autoLockMode: AutoLockMode;
  retentionYears: number | null;
  configured: boolean;
  auditEntries: number;
};

export type AuditEntry = {
  id: string;
  seq: number;
  objectType: AuditObjectType;
  objectId: string;
  action: AuditAction;
  userId: string | null;
  createdAt: string;
  diff: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

export type KettenBruch = {
  seq: number;
  id: string;
  reason: "hash_mismatch" | "prev_hash_mismatch";
};

export type VerifyResult = {
  ok: boolean;
  checked: number;
  firstBreak: KettenBruch | null;
  lastHash: string | null;
  verifiedAt: string;
};

export type AuditFilter = {
  objectType?: AuditObjectType;
  objectId?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  limit?: number;
};
