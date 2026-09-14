"use server";

// Buchhaltung → Steuer: Server-Actions gegen den FastAPI-Bereich
// /api/v1/buchhaltung/tax/*. NUR async functions in dieser Datei ("use server"
// verbietet Werte-Exporte — Typen liegen in buchhaltung-steuer-typen.ts).
// Alle Beträge werden im Backend gerechnet; hier wird nur durchgereicht.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  ProfitEstimate,
  SteuerResult,
  TaxReturn,
  TaxReturnList,
  TaxSettings,
  TaxSettingsInput,
  VatReturn,
} from "@/lib/buchhaltung-steuer-typen";
import { currentToken } from "@/lib/session-token";

const SEITE = "/buchhaltung/steuer";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT"; body?: unknown } = {},
): Promise<SteuerResult<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/buchhaltung/tax${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Live-Auswertung einer Periode (`2026-08`, `2026-Q3`, `2026`). */
export async function getVatReturn(period: string): Promise<SteuerResult<VatReturn>> {
  return call(`/vat-return?period=${encodeURIComponent(period)}`);
}

/** Werte der Periode einfrieren (idempotent). */
export async function freezeVatReturn(
  period: string,
  note?: string,
): Promise<SteuerResult<TaxReturn>> {
  const res = await call<TaxReturn>("/vat-return/freeze", {
    method: "POST",
    body: { period, note: note || null },
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function listTaxReturns(): Promise<SteuerResult<TaxReturnList>> {
  return call("/returns?limit=200");
}

export async function updateTaxReturn(
  id: string,
  patch: { status?: "submitted"; submittedAt?: string | null; note?: string | null },
): Promise<SteuerResult<TaxReturn>> {
  const res = await call<TaxReturn>(`/returns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function getProfitEstimate(year: number): Promise<SteuerResult<ProfitEstimate>> {
  return call(`/profit-estimate?year=${year}`);
}

export async function getTaxSettings(): Promise<SteuerResult<TaxSettings>> {
  return call("/settings");
}

export async function saveTaxSettings(
  input: TaxSettingsInput,
): Promise<SteuerResult<TaxSettings>> {
  const res = await call<TaxSettings>("/settings", { method: "PUT", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}
