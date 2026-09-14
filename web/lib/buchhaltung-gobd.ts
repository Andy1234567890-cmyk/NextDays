"use server";

// GoBD: Server-Actions gegen /api/v1/buchhaltung/gobd/*. NUR async functions
// (Regel „use server"): Typen liegen in buchhaltung-gobd-typen.ts. Festschreibung,
// Hash-Kette und Export-ZIP rechnet ausschließlich das Backend — hier wird nur
// durchgereicht und revalidiert.
//
// Der Export (ZIP) läuft NICHT über diese Datei: er ist ein Dateidownload und
// gehört in den Browser (siehe export-dialog.tsx, das den authentifizierten
// Proxy `/api/v1/buchhaltung/gobd/export` direkt anspricht).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  AuditEntry,
  AuditFilter,
  AutoLockRunResult,
  GobdSettings,
  GobdSettingsInput,
  GobdStatus,
  LockResult,
  OffeneRechnung,
  VerifyResult,
} from "@/lib/buchhaltung-gobd-typen";
import { currentToken } from "@/lib/session-token";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

const SEITE = "/buchhaltung/gobd";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/buchhaltung${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
      status: exc instanceof ApiError ? exc.status : undefined,
    };
  }
}

export async function getGobdSettings(): Promise<Result<GobdSettings>> {
  return call<GobdSettings>("/gobd/settings");
}

export async function saveGobdSettings(input: GobdSettingsInput): Promise<Result<GobdSettings>> {
  const res = await call<GobdSettings>("/gobd/settings", { method: "PUT", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function getGobdStatus(): Promise<Result<GobdStatus>> {
  return call<GobdStatus>("/gobd/status");
}

export async function listOpenInvoices(limit = 200): Promise<Result<OffeneRechnung[]>> {
  return call<OffeneRechnung[]>(`/gobd/open-invoices?limit=${limit}`);
}

export async function lockInvoices(invoiceIds: string[], reason?: string): Promise<Result<LockResult>> {
  const res = await call<LockResult>("/gobd/lock", {
    method: "POST",
    body: { invoiceIds, reason },
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function runAutoLock(): Promise<Result<AutoLockRunResult>> {
  const res = await call<AutoLockRunResult>("/gobd/auto-lock/run", { method: "POST" });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function listAuditLog(filter?: AuditFilter): Promise<Result<AuditEntry[]>> {
  const q = new URLSearchParams();
  if (filter?.objectType) q.set("objectType", filter.objectType);
  if (filter?.objectId) q.set("objectId", filter.objectId);
  if (filter?.action) q.set("action", filter.action);
  if (filter?.from) q.set("from", filter.from);
  if (filter?.to) q.set("to", filter.to);
  if (filter?.limit) q.set("limit", String(filter.limit));
  const suffix = q.size ? `?${q.toString()}` : "";
  return call<AuditEntry[]>(`/gobd/audit-log${suffix}`);
}

export async function verifyAuditChain(): Promise<Result<VerifyResult>> {
  return call<VerifyResult>("/gobd/audit-log/verify");
}
