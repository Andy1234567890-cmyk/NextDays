"use server";

// Buchhaltung → Artikel: Server-Actions gegen den Bereich »artikel« des
// FastAPI-buchhaltung-Slice (/api/v1/buchhaltung/items). Tenant-scoped,
// Beträge bleiben Strings (Decimal). NUR async functions in dieser Datei —
// Typen liegen in buchhaltung-artikel-typen.ts.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  BillingItem,
  BillingItemCategory,
  BillingItemInput,
  BillingItemUpdate,
  BillingItemUsed,
  ListItemsFilter,
  Result,
} from "@/lib/buchhaltung-artikel-typen";
import { currentToken } from "@/lib/session-token";

const SEITE = "/buchhaltung/artikel";

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

function query(filter: ListItemsFilter): string {
  const p = new URLSearchParams();
  if (filter.search?.trim()) p.set("search", filter.search.trim());
  if (filter.category?.trim()) p.set("category", filter.category.trim());
  if (filter.onlyActive) p.set("onlyActive", "true");
  if (filter.favoritesOnly) p.set("favoritesOnly", "true");
  if (filter.limit) p.set("limit", String(filter.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listItems(filter: ListItemsFilter = {}): Promise<Result<BillingItem[]>> {
  return call<BillingItem[]>(`/items${query(filter)}`);
}

export async function listFavorites(): Promise<Result<BillingItem[]>> {
  return call<BillingItem[]>("/items/favorites");
}

export async function listCategories(): Promise<Result<BillingItemCategory[]>> {
  return call<BillingItemCategory[]>("/items/categories");
}

export async function getItem(id: string): Promise<Result<BillingItem>> {
  return call<BillingItem>(`/items/${encodeURIComponent(id)}`);
}

export async function createItem(input: BillingItemInput): Promise<Result<BillingItem>> {
  const res = await call<BillingItem>("/items", { method: "POST", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function updateItem(
  id: string,
  input: BillingItemUpdate,
): Promise<Result<BillingItem>> {
  const res = await call<BillingItem>(`/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function deleteItem(id: string): Promise<Result<void>> {
  const res = await call<void>(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

/** Zielzustand setzen (idempotent) — kein Toggle, damit ein Doppelklick nicht
 *  an/aus schaltet. */
export async function setFavorite(id: string, isFavorite: boolean): Promise<Result<BillingItem>> {
  const res = await call<BillingItem>(`/items/${encodeURIComponent(id)}/favorite`, {
    method: "POST",
    body: { isFavorite },
  });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

/** Verwendung zählen, sobald ein Artikel in eine Position übernommen wurde.
 *  Zählt atomar in der DB; die Seite muss dafür nicht neu geladen werden. */
export async function markItemUsed(id: string): Promise<Result<BillingItemUsed>> {
  return call<BillingItemUsed>(`/items/${encodeURIComponent(id)}/used`, { method: "POST" });
}
