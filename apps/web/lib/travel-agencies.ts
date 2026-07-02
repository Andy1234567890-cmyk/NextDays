"use server";

// Reisebüro-/Partner-Kartei: Server-Actions gegen den FastAPI-Slice
// (/api/v1/travel-agencies). Stammdaten, Kontakte, Verträge (nach Jahren)
// und Saison-Preiszeilen; Vertragsdateien laufen über den privaten Bucket
// (Upload multipart, Download als signierte URL).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AgencyKind = "travel_agent" | "tour_operator" | "company" | "source";
export type Settlement = "hotel_collect" | "agency_collect";
export type ContractKind = "allotment" | "guarantee" | "free_sale" | "other";
export type RateBasis = "net" | "gross";

export type Agency = {
  id: string;
  kind: AgencyKind;
  name: string;
  iata_number: string | null;
  vat_id: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  language: string | null;
  currency: string | null;
  commission_pct: number | null;
  settlement: Settlement | null;
  payment_term_days: number | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AgencyContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export type AgencyContract = {
  id: string;
  agency_id: string;
  title: string;
  kind: ContractKind;
  valid_from: string; // YYYY-MM-DD
  valid_to: string;
  currency: string;
  commission_pct: number | null;
  release_days: number | null;
  storage_path: string | null;
  file_name: string | null;
  notes: string | null;
};

export type AgencyRate = {
  id: string;
  contract_id: string;
  property_id: string;
  season_start: string;
  season_end: string;
  price: number;
  basis: RateBasis;
  min_stay: number | null;
};

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
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

export async function listAgencies(
  q?: string,
  includeInactive = false,
): Promise<Result<{ items: Agency[]; total: number }>> {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (includeInactive) qs.set("include_inactive", "true");
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/travel-agencies${suffix}`);
}

export async function createAgency(input: Partial<Agency> & { name: string }): Promise<Result<Agency>> {
  return call("/travel-agencies", { method: "POST", body: input });
}

export async function getAgency(id: string): Promise<Result<Agency>> {
  return call(`/travel-agencies/${id}`);
}

export async function updateAgency(
  id: string,
  patch: Partial<Agency>,
): Promise<Result<Agency>> {
  return call(`/travel-agencies/${id}`, { method: "PATCH", body: patch });
}

export async function deleteAgency(id: string): Promise<Result<void>> {
  return call(`/travel-agencies/${id}`, { method: "DELETE" });
}

export async function listAgencyContacts(agencyId: string): Promise<Result<AgencyContact[]>> {
  return call(`/travel-agencies/${agencyId}/contacts`);
}

export async function addAgencyContact(
  agencyId: string,
  input: Omit<AgencyContact, "id">,
): Promise<Result<AgencyContact>> {
  return call(`/travel-agencies/${agencyId}/contacts`, { method: "POST", body: input });
}

export async function deleteAgencyContact(
  agencyId: string,
  contactId: string,
): Promise<Result<void>> {
  return call(`/travel-agencies/${agencyId}/contacts/${contactId}`, { method: "DELETE" });
}

export async function listAgencyContracts(
  agencyId: string,
): Promise<Result<{ items: AgencyContract[]; total: number }>> {
  return call(`/travel-agencies/${agencyId}/contracts`);
}

export async function addAgencyContract(
  agencyId: string,
  input: Omit<AgencyContract, "id" | "agency_id" | "storage_path" | "file_name">,
): Promise<Result<AgencyContract>> {
  return call(`/travel-agencies/${agencyId}/contracts`, { method: "POST", body: input });
}

export async function updateAgencyContract(
  agencyId: string,
  contractId: string,
  patch: Partial<Omit<AgencyContract, "id" | "agency_id">>,
): Promise<Result<AgencyContract>> {
  return call(`/travel-agencies/${agencyId}/contracts/${contractId}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteAgencyContract(
  agencyId: string,
  contractId: string,
): Promise<Result<void>> {
  return call(`/travel-agencies/${agencyId}/contracts/${contractId}`, { method: "DELETE" });
}

// Vertragsdokument hochladen (multipart, Muster lib/properties.ts).
export async function uploadContractFile(
  agencyId: string,
  contractId: string,
  file: File,
): Promise<Result<AgencyContract>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(
      `${base}/api/v1/travel-agencies/${agencyId}/contracts/${contractId}/file`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as AgencyContract };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Signierte Download-URL des Vertragsdokuments (zeitlich begrenzt). */
export async function contractFileUrl(
  agencyId: string,
  contractId: string,
): Promise<Result<{ url: string; expires_in: number }>> {
  return call(`/travel-agencies/${agencyId}/contracts/${contractId}/file-url`);
}

export async function listContractRates(
  agencyId: string,
  contractId: string,
): Promise<Result<{ items: AgencyRate[]; total: number }>> {
  return call(`/travel-agencies/${agencyId}/contracts/${contractId}/rates`);
}

export async function addContractRate(
  agencyId: string,
  contractId: string,
  input: Omit<AgencyRate, "id" | "contract_id">,
): Promise<Result<AgencyRate>> {
  return call(`/travel-agencies/${agencyId}/contracts/${contractId}/rates`, {
    method: "POST",
    body: input,
  });
}

export async function deleteContractRate(
  agencyId: string,
  contractId: string,
  rateId: string,
): Promise<Result<void>> {
  return call(`/travel-agencies/${agencyId}/contracts/${contractId}/rates/${rateId}`, {
    method: "DELETE",
  });
}
