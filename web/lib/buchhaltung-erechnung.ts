"use server";

// Buchhaltung → E-Rechnung: Server-Actions gegen den Bereich »erechnung«
// (/api/v1/buchhaltung/einvoices…). Das XML erzeugt weiterhin der Browser
// (services/eInvoiceService.ts) — hier wird es geprüft, abgelegt und
// protokolliert. Beträge/Status kommen ausschließlich vom Server.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type { Result } from "@/lib/buchhaltung";
import type {
  Compliance,
  EInvoice,
  EInvoiceCreateInput,
  EInvoiceSettings,
  EInvoiceSettingsInput,
  Transmission,
  TransmissionInput,
  ValidationStatus,
} from "@/lib/buchhaltung-erechnung-typen";
import { currentToken } from "@/lib/session-token";

const SEITE = "/buchhaltung/e-rechnung";

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
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export async function getCompliance(
  from?: string,
  to?: string,
): Promise<Result<Compliance>> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  return call(`/einvoices/compliance${q ? `?${q}` : ""}`);
}

export async function listEInvoices(filter: {
  invoiceId?: string;
  validationStatus?: ValidationStatus;
} = {}): Promise<Result<EInvoice[]>> {
  const params = new URLSearchParams();
  if (filter.invoiceId) params.set("invoiceId", filter.invoiceId);
  if (filter.validationStatus) params.set("validationStatus", filter.validationStatus);
  const q = params.toString();
  return call(`/einvoices${q ? `?${q}` : ""}`);
}

export async function getEInvoice(id: string): Promise<Result<EInvoice>> {
  return call(`/einvoices/${encodeURIComponent(id)}`);
}

export async function createEInvoice(
  input: EInvoiceCreateInput,
): Promise<Result<EInvoice>> {
  const res = await call<EInvoice>("/einvoices", { method: "POST", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function validateEInvoice(id: string): Promise<Result<EInvoice>> {
  const res = await call<EInvoice>(`/einvoices/${encodeURIComponent(id)}/validate`, {
    method: "POST",
  });
  if (res.ok) {
    revalidatePath(SEITE);
    revalidatePath(`${SEITE}/${id}`);
  }
  return res;
}

export async function addTransmission(
  id: string,
  input: TransmissionInput,
): Promise<Result<Transmission>> {
  const res = await call<Transmission>(
    `/einvoices/${encodeURIComponent(id)}/transmissions`,
    { method: "POST", body: input },
  );
  if (res.ok) revalidatePath(`${SEITE}/${id}`);
  return res;
}

export async function getEInvoiceSettings(): Promise<Result<EInvoiceSettings>> {
  return call("/einvoices/settings");
}

export async function saveEInvoiceSettings(
  input: EInvoiceSettingsInput,
): Promise<Result<EInvoiceSettings>> {
  const res = await call<EInvoiceSettings>("/einvoices/settings", {
    method: "PUT",
    body: input,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}
