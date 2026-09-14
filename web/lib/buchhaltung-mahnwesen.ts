"use server";

// Mahnwesen: Server-Actions gegen /api/v1/buchhaltung/reminders/*.
// NUR async functions (Regel „use server"): Typen liegen in
// buchhaltung-mahnwesen-typen.ts. Beträge, Stufen und Fristen rechnet der
// Server — hier wird nur durchgereicht und revalidiert.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  FirmaKopf,
  OverdueInvoice,
  Reminder,
  ReminderCreateInput,
  ReminderList,
  ReminderSendInput,
  ReminderSettings,
  ReminderSettingsInput,
  ReminderStatus,
  ReminderUpdateInput,
  SendResult,
} from "@/lib/buchhaltung-mahnwesen-typen";
import { currentToken } from "@/lib/session-token";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

const SEITE = "/buchhaltung/mahnwesen";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
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

export async function getReminderSettings(): Promise<Result<ReminderSettings>> {
  return call<ReminderSettings>("/reminders/settings");
}

export async function saveReminderSettings(
  input: ReminderSettingsInput,
): Promise<Result<ReminderSettings>> {
  const res = await call<ReminderSettings>("/reminders/settings", { method: "PUT", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function listOverdueInvoices(): Promise<Result<OverdueInvoice[]>> {
  return call<OverdueInvoice[]>("/reminders/overdue-invoices");
}

export async function listReminders(filter?: {
  status?: ReminderStatus;
  invoiceId?: string;
  limit?: number;
}): Promise<Result<ReminderList>> {
  const q = new URLSearchParams();
  if (filter?.status) q.set("status", filter.status);
  if (filter?.invoiceId) q.set("invoiceId", filter.invoiceId);
  if (filter?.limit) q.set("limit", String(filter.limit));
  const suffix = q.size ? `?${q.toString()}` : "";
  return call<ReminderList>(`/reminders${suffix}`);
}

export async function getReminder(id: string): Promise<Result<Reminder>> {
  return call<Reminder>(`/reminders/${encodeURIComponent(id)}`);
}

export async function createReminder(input: ReminderCreateInput): Promise<Result<Reminder>> {
  const res = await call<Reminder>("/reminders", { method: "POST", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function updateReminder(
  id: string,
  input: ReminderUpdateInput,
): Promise<Result<Reminder>> {
  const res = await call<Reminder>(`/reminders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function setReminderStatus(
  id: string,
  status: ReminderStatus,
): Promise<Result<Reminder>> {
  const res = await call<Reminder>(`/reminders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function deleteReminder(id: string): Promise<Result<null>> {
  const res = await call<null>(`/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function sendReminder(
  id: string,
  input: ReminderSendInput,
): Promise<Result<SendResult>> {
  const res = await call<SendResult>(`/reminders/${encodeURIComponent(id)}/send`, {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

// Absender für den PDF-Kopf: das Firmenprofil des Betriebs (Konto-Stammdaten,
// eigener Guard, kein Modul-Gate). Fehlende Felder bleiben leer — der PDF-
// Erzeuger lässt leere Zeilen weg, erfindet nichts (Wurzel 4).
export async function getFirmaKopf(): Promise<Result<FirmaKopf>> {
  const res = await call<Record<string, unknown>>("/companies/me");
  if (!res.ok) return res;
  const s = (k: string): string => (typeof res.data[k] === "string" ? (res.data[k] as string) : "");
  return {
    ok: true,
    data: {
      companyName: s("companyName") || s("name"),
      companyStreet: s("companyStreet"),
      companyHouseNumber: s("companyHouseNumber"),
      companyPostalCode: s("companyPostalCode"),
      companyCity: s("companyCity"),
      companyCountry: s("companyCountry"),
      email: s("email"),
      phoneNumber: s("phoneNumber"),
      vatId: s("vatId"),
      iban: s("iban"),
      bic: s("bic"),
      bankName: s("bankName"),
    },
  };
}
