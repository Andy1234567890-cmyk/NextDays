"use server";

// Bereich »kontakte« der Buchhaltung: Server-Actions gegen
// /api/v1/buchhaltung/customers/{id}/{contacts,addresses,notes,overview} und
// /api/v1/buchhaltung/suppliers. Nur async functions in dieser Datei — Typen
// liegen in buchhaltung-kontakte-typen.ts ("use server" verträgt keine
// Wert-Exporte).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  Anschrift,
  AnschriftEingabe,
  Ansprechpartner,
  AnsprechpartnerEingabe,
  KundeDetail,
  KundenUebersicht,
  Lieferant,
  Notiz,
  NotizEingabe,
  Result,
} from "@/lib/buchhaltung-kontakte-typen";
import { currentToken } from "@/lib/session-token";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
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

function kundenPfad(customerId: string): string {
  return `/buchhaltung/kunden/${customerId}`;
}

// --- Kunde + Übersicht ------------------------------------------------------

export async function getKunde(customerId: string): Promise<Result<KundeDetail>> {
  return call(`/customers/${encodeURIComponent(customerId)}`);
}

export async function getKundenUebersicht(
  customerId: string,
  limit = 50,
): Promise<Result<KundenUebersicht>> {
  return call(`/customers/${encodeURIComponent(customerId)}/overview?limit=${limit}`);
}

// --- Ansprechpartner --------------------------------------------------------

export async function listAnsprechpartner(customerId: string): Promise<Result<Ansprechpartner[]>> {
  return call(`/customers/${encodeURIComponent(customerId)}/contacts`);
}

export async function createAnsprechpartner(
  customerId: string,
  input: AnsprechpartnerEingabe,
): Promise<Result<Ansprechpartner>> {
  const res = await call<Ansprechpartner>(`/customers/${encodeURIComponent(customerId)}/contacts`, {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

export async function updateAnsprechpartner(
  customerId: string,
  contactId: string,
  input: Partial<AnsprechpartnerEingabe>,
): Promise<Result<Ansprechpartner>> {
  const res = await call<Ansprechpartner>(
    `/customers/${encodeURIComponent(customerId)}/contacts/${encodeURIComponent(contactId)}`,
    { method: "PATCH", body: input },
  );
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

export async function deleteAnsprechpartner(
  customerId: string,
  contactId: string,
): Promise<Result<void>> {
  const res = await call<void>(
    `/customers/${encodeURIComponent(customerId)}/contacts/${encodeURIComponent(contactId)}`,
    { method: "DELETE" },
  );
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

// --- Anschriften ------------------------------------------------------------

export async function listAnschriften(customerId: string): Promise<Result<Anschrift[]>> {
  return call(`/customers/${encodeURIComponent(customerId)}/addresses`);
}

export async function createAnschrift(
  customerId: string,
  input: AnschriftEingabe,
): Promise<Result<Anschrift>> {
  const res = await call<Anschrift>(`/customers/${encodeURIComponent(customerId)}/addresses`, {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

export async function updateAnschrift(
  customerId: string,
  addressId: string,
  input: Partial<AnschriftEingabe>,
): Promise<Result<Anschrift>> {
  const res = await call<Anschrift>(
    `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
    { method: "PATCH", body: input },
  );
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

export async function deleteAnschrift(customerId: string, addressId: string): Promise<Result<void>> {
  const res = await call<void>(
    `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
    { method: "DELETE" },
  );
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

// --- Notizen ----------------------------------------------------------------

export async function listNotizen(customerId: string): Promise<Result<Notiz[]>> {
  return call(`/customers/${encodeURIComponent(customerId)}/notes`);
}

export async function createNotiz(customerId: string, input: NotizEingabe): Promise<Result<Notiz>> {
  const res = await call<Notiz>(`/customers/${encodeURIComponent(customerId)}/notes`, {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

export async function updateNotiz(
  customerId: string,
  noteId: string,
  input: Partial<NotizEingabe>,
): Promise<Result<Notiz>> {
  const res = await call<Notiz>(
    `/customers/${encodeURIComponent(customerId)}/notes/${encodeURIComponent(noteId)}`,
    { method: "PATCH", body: input },
  );
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

export async function deleteNotiz(customerId: string, noteId: string): Promise<Result<void>> {
  const res = await call<void>(
    `/customers/${encodeURIComponent(customerId)}/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE" },
  );
  if (res.ok) revalidatePath(kundenPfad(customerId));
  return res;
}

// --- Lieferanten ------------------------------------------------------------

export async function listLieferanten(search?: string): Promise<Result<Lieferant[]>> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const res = await call<Lieferant[]>(`/suppliers${q}`);
  if (!res.ok) return res;
  return { ok: true, data: Array.isArray(res.data) ? res.data : [] };
}
