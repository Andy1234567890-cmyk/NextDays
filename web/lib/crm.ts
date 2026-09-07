"use server";

// CRM (Lastenheft §2.6): Server-Actions gegen den FastAPI-Slice /api/v1/crm.
// Eigentümer-Akquise (Leads, Notizen-Verlauf, Konvertierung zu Eigentümer +
// Objekt) und Partner & Deals (B2B-Rabatte, QR-Code im privaten Bucket).
// Business-Logik bleibt im Backend (PROJECT.md §2); hier nur HTTP.
//
// Ein "use server"-Modul darf AUSSCHLIESSLICH async functions exportieren —
// Typen sind erlaubt (kein Laufzeitwert), Konstanten/Objekte NICHT. Die
// Status- und Quellen-Listen stehen deshalb in `lib/crm-meta.ts`.
import { ApiError, api } from "@/lib/api";
import type {
  Deal,
  DiscountKind,
  Lead,
  LeadConvertResult,
  LeadNote,
  LeadSource,
  LeadStatus,
  Partner,
} from "@/lib/crm-meta";
import { currentToken } from "@/lib/session-token";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; details?: Record<string, unknown> };

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
    const status = exc instanceof ApiError ? exc.status : undefined;
    // Strukturierte Angaben (z. B. `fehlende_felder` der Konvertierung) neben
    // der Meldung weiterreichen — der Dialog markiert damit die Felder.
    const details = exc instanceof ApiError ? exc.details : undefined;
    return { ok: false, error, status, details };
  }
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

// --- Leads --------------------------------------------------------------------

export async function listLeads(params: {
  status?: LeadStatus;
  lead_source?: LeadSource;
  assigned_user_id?: string;
  q?: string;
  offset?: number;
  limit?: number;
} = {}): Promise<Result<{ items: Lead[]; total: number; offset: number; limit: number }>> {
  return call(`/crm/leads${qs(params)}`);
}

export async function createLead(
  input: Partial<Lead> & { name: string; erste_notiz?: string | null },
): Promise<Result<Lead>> {
  return call("/crm/leads", { method: "POST", body: input });
}

export async function getLead(id: string): Promise<Result<Lead>> {
  return call(`/crm/leads/${encodeURIComponent(id)}`);
}

export async function updateLead(
  id: string,
  patch: Partial<Lead> & { lost_reason?: string | null },
): Promise<Result<Lead>> {
  return call(`/crm/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export async function deleteLead(id: string): Promise<Result<void>> {
  return call(`/crm/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listLeadNotes(id: string): Promise<Result<LeadNote[]>> {
  return call(`/crm/leads/${encodeURIComponent(id)}/notes`);
}

export async function addLeadNote(id: string, body: string): Promise<Result<LeadNote>> {
  return call(`/crm/leads/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    body: { body },
  });
}

export async function convertLead(
  id: string,
  input: {
    mit_objekt: boolean;
    property_title?: string | null;
    property_type?: string | null;
    default_commission_pct?: number | null;
    portalzugang?: boolean;
  },
): Promise<Result<LeadConvertResult>> {
  return call(`/crm/leads/${encodeURIComponent(id)}/convert`, { method: "POST", body: input });
}

// --- Partner ------------------------------------------------------------------

export async function listPartners(
  q?: string,
): Promise<Result<{ items: Partner[]; total: number }>> {
  return call(`/crm/partners${qs({ q })}`);
}

export async function createPartner(
  input: Partial<Partner> & { name: string },
): Promise<Result<Partner>> {
  return call("/crm/partners", { method: "POST", body: input });
}

export async function getPartner(id: string): Promise<Result<Partner>> {
  return call(`/crm/partners/${encodeURIComponent(id)}`);
}

export async function updatePartner(
  id: string,
  patch: Partial<Partner>,
): Promise<Result<Partner>> {
  return call(`/crm/partners/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export async function deletePartner(id: string): Promise<Result<void>> {
  return call(`/crm/partners/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- Deals ----------------------------------------------------------------------

export async function listDeals(
  partnerId: string,
): Promise<Result<{ items: Deal[]; total: number }>> {
  return call(`/crm/partners/${encodeURIComponent(partnerId)}/deals`);
}

export async function createDeal(
  partnerId: string,
  input: {
    discount_kind: DiscountKind;
    discount_value: number;
    currency?: string | null;
    discount_code?: string | null;
    gueltig_von?: string | null;
    gueltig_bis?: string | null;
    im_gastportal_sichtbar?: boolean;
  },
): Promise<Result<Deal>> {
  return call(`/crm/partners/${encodeURIComponent(partnerId)}/deals`, {
    method: "POST",
    body: input,
  });
}

export async function updateDeal(id: string, patch: Partial<Deal>): Promise<Result<Deal>> {
  return call(`/crm/deals/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export async function deleteDeal(id: string): Promise<Result<void>> {
  return call(`/crm/deals/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Signierte, kurzlebige URL des hochgeladenen QR-Bilds (privater Bucket). */
export async function dealQrUrl(
  id: string,
): Promise<Result<{ url: string; expires_in: number }>> {
  return call(`/crm/deals/${encodeURIComponent(id)}/qr-url`);
}

/** QR-Bild hochladen (multipart). Erkannt am Inhalt, nicht am Dateinamen. */
export async function uploadDealQr(id: string, file: File): Promise<Result<Deal>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const { apiBasis } = await import("@/lib/api");
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${apiBasis()}/crm/deals/${encodeURIComponent(id)}/qr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
        else if (typeof data?.detail?.message === "string") detail = data.detail.message;
      } catch {
        // kein JSON — Standardmeldung behalten
      }
      return { ok: false, error: detail, status: res.status };
    }
    return { ok: true, data: (await res.json()) as Deal };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof Error ? exc.message : "Upload fehlgeschlagen.",
    };
  }
}

/** Erzeugter QR (PNG) aus dem Rabattcode — als data-URL für die Vorschau. */
export async function dealQrPng(id: string): Promise<Result<string>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const { apiBasis } = await import("@/lib/api");
  try {
    const res = await fetch(`${apiBasis()}/crm/deals/${encodeURIComponent(id)}/qr.png`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON — Standardmeldung behalten
      }
      return { ok: false, error: detail, status: res.status };
    }
    const puffer = Buffer.from(await res.arrayBuffer());
    return { ok: true, data: `data:image/png;base64,${puffer.toString("base64")}` };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof Error ? exc.message : "QR nicht abrufbar.",
    };
  }
}
