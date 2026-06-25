"use server";

// Eigentümer-Verwaltung: Server-Actions gegen den FastAPI-owners-Slice
// (/api/v1/owners). Die Agentur verwaltet Objekte für fremde Eigentümer —
// Stammdaten, Auszahlungs-/Provisions-Konfig, Objekt-Zuordnung. Business-Logik
// bleibt im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type StatementFrequency = "none" | "monthly";

export type OwnerPropertyLink = {
  property_id: string;
  ownership_share: number;
  commission_override_pct: number | null;
};

export type Owner = {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  vat_id: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  account_holder: string | null;
  default_commission_pct: number;
  default_payout_method: string | null;
  statement_frequency: StatementFrequency;
  notes: string | null;
  user_id: string | null;
  properties: OwnerPropertyLink[];
  created_at: string | null;
  updated_at: string | null;
};

export type OwnerListItem = Omit<Owner, "properties"> & {
  property_count: number;
};

export type OwnerInput = Partial<
  Omit<Owner, "id" | "tenant_id" | "properties" | "created_at" | "updated_at">
> & { name?: string };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

export async function listOwners(): Promise<
  Result<{ items: OwnerListItem[]; total: number }>
> {
  return call("/owners");
}

export async function getOwner(id: string): Promise<Result<Owner>> {
  return call(`/owners/${id}`);
}

export async function createOwner(input: OwnerInput): Promise<Result<Owner>> {
  return call("/owners", { method: "POST", body: input });
}

export async function updateOwner(
  id: string,
  input: OwnerInput,
): Promise<Result<Owner>> {
  return call(`/owners/${id}`, { method: "PATCH", body: input });
}

export async function deleteOwner(id: string): Promise<Result<null>> {
  return call(`/owners/${id}`, { method: "DELETE" });
}

/**
 * Objekte, die diesem Eigentümer zugeordnet werden dürfen: frei (keinem Owner
 * zugeordnet) oder bereits dieser Owner. Objekte anderer Eigentümer fehlen —
 * ein Objekt gehört genau einem Eigentümer.
 */
export async function getAvailableProperties(
  ownerId: string,
): Promise<Result<{ items: { id: string; title: string }[] }>> {
  return call(`/owners/${ownerId}/available-properties`);
}

/** Objekt zuordnen oder Anteil/Provisions-Override aktualisieren. */
export async function assignOwnerProperty(
  ownerId: string,
  input: {
    property_id: string;
    ownership_share?: number;
    commission_override_pct?: number | null;
  },
): Promise<Result<Owner>> {
  return call(`/owners/${ownerId}/properties`, { method: "POST", body: input });
}

export async function unassignOwnerProperty(
  ownerId: string,
  propertyId: string,
): Promise<Result<Owner>> {
  return call(`/owners/${ownerId}/properties/${propertyId}`, {
    method: "DELETE",
  });
}
