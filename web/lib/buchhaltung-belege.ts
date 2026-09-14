"use server";

// Buchhaltung → Belege: Server-Actions gegen den Bereich »belege« des
// FastAPI-buchhaltung-Slice (/api/v1/buchhaltung/documents). Belegkette
// (Angebot → AB → Lieferschein → Rechnung → Gutschrift), Festschreibung mit
// Nummernzug, wiederkehrende Rechnungen. Beträge und Nummern kommen NIE aus
// dem Browser — das Backend rechnet und zieht.
//
// Nur async functions exportieren ("use server"); Typen liegen in
// buchhaltung-belege-typen.ts.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  Beleg,
  Belegart,
  BelegListe,
  RecurringCreateInput,
  RecurringRunResult,
  RecurringUpdateInput,
  Zielart,
} from "@/lib/buchhaltung-belege-typen";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

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

function neuLaden(): void {
  revalidatePath("/buchhaltung/belege");
  revalidatePath("/buchhaltung/angebote");
  revalidatePath("/buchhaltung");
}

export async function listBelege(
  type: Belegart,
  opts: { status?: string; customerId?: string; limit?: number } = {},
): Promise<Result<BelegListe>> {
  const q = new URLSearchParams({ type });
  if (opts.status) q.set("status", opts.status);
  if (opts.customerId) q.set("customer_id", opts.customerId);
  if (opts.limit) q.set("limit", String(opts.limit));
  return call<BelegListe>(`/documents?${q.toString()}`);
}

export async function getBeleg(id: string, type: Belegart = "invoice"): Promise<Result<Beleg>> {
  return call<Beleg>(`/documents/${encodeURIComponent(id)}?type=${type}`);
}

/** Kette: Folgebeleg als ENTWURF anlegen (Positionen übernommen, Beträge neu). */
export async function convertBeleg(
  id: string,
  sourceType: Belegart,
  target: Zielart,
): Promise<Result<Beleg>> {
  const res = await call<Beleg>(`/documents/${encodeURIComponent(id)}/convert`, {
    method: "POST",
    body: { target, sourceType },
  });
  if (res.ok) neuLaden();
  return res;
}

/** Nummer aus dem Kreis der Belegart ziehen und festschreiben. */
export async function finalizeBeleg(id: string): Promise<Result<Beleg>> {
  const res = await call<Beleg>(`/documents/${encodeURIComponent(id)}/finalize`, {
    method: "POST",
  });
  if (res.ok) neuLaden();
  return res;
}

export async function createRecurringVorlage(
  invoiceId: string,
  input: RecurringCreateInput,
): Promise<Result<Beleg>> {
  const res = await call<Beleg>(`/documents/${encodeURIComponent(invoiceId)}/recurring`, {
    method: "POST",
    body: input,
  });
  if (res.ok) neuLaden();
  return res;
}

export async function updateRecurringVorlage(
  vorlageId: string,
  input: RecurringUpdateInput,
): Promise<Result<Beleg>> {
  const res = await call<Beleg>(`/documents/${encodeURIComponent(vorlageId)}/recurring`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) neuLaden();
  return res;
}

/** Fällige Vorlagen jetzt abarbeiten (idempotent — ein zweiter Klick erzeugt nichts). */
export async function runRecurring(): Promise<Result<RecurringRunResult>> {
  const res = await call<RecurringRunResult>("/documents/recurring/run", { method: "POST" });
  if (res.ok) neuLaden();
  return res;
}
