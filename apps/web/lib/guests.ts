"use server";

// Gästekarte (Enterprise-Gästeprofil): Server-Actions gegen den FastAPI-
// guests-Slice (/api/v1/guests). Stammdaten + Sub-Ressourcen + Joins. Die
// Feldmaskierung (Name/Kontakt/Beträge/Ausweis) passiert serverseitig — das
// Frontend rendert nur, was es bekommt (maskierte Werte sind null bzw. „•••").
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Guest = {
  id: string;
  tenant_id: string;
  name: string | null;
  salutation: string | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_name: string | null;
  birth_date: string | null;
  birth_place: string | null;
  gender: string | null;
  nationality: string | null;
  language: string | null;
  currency: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  vat_id: string | null;
  vip_code: string | null;
  segment: string | null;
  source: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  stays_count: number;
  last_stay_at: string | null;
  total_revenue: number | null;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GuestListItem = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  vip_code: string | null;
  segment: string | null;
  is_blocked: boolean;
  stays_count: number;
  last_stay_at: string | null;
};

export type GuestAddress = {
  id: string;
  guest_id: string;
  type: string;
  street: string | null;
  house_no: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  is_primary: boolean;
};

export type GuestContact = {
  id: string;
  guest_id: string;
  type: string;
  value: string;
  is_primary: boolean;
};

export type GuestIdentityDoc = {
  id: string;
  guest_id: string;
  doc_type: string;
  number: string | null; // maskiert ohne Berechtigung (••• 1234)
  issuing_country: string | null;
  valid_until: string | null;
};

export type GuestPreferences = {
  guest_id: string;
  non_smoking: boolean | null;
  pets: boolean | null;
  dietary: string | null;
  preferred_arrival_time: string | null;
  room_preferences: string | null;
  language: string | null;
  wishes: string | null;
};

export type GuestConsent = {
  id: string;
  guest_id: string;
  consent_type: string;
  status: string;
  source: string | null;
  expires_at: string | null;
  created_at: string;
};

export type GuestNote = {
  id: string;
  guest_id: string;
  author_id: string | null;
  author_name: string | null;
  category: string | null;
  body: string;
  created_at: string;
};

export type GuestDocument = {
  id: string;
  guest_id: string;
  name: string;
  doc_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type GuestReservation = {
  id: string;
  property_id: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
  channel: string | null;
  total_amount: number | null;
  currency: string | null;
};

export type GuestThread = {
  id: string;
  ota_name: string | null;
  ota_reservation_code: string | null;
  last_message_at: string | null;
};

export type GuestInvoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  issue_date: string | null;
  gross_amount: number | null;
  currency: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type ListT<T> = { items: T[]; total: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/guests${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

// --- Gäste ------------------------------------------------------------------
export async function listGuests(
  opts: { q?: string; vip?: string; segment?: string; blocked?: boolean } = {},
): Promise<Result<ListT<GuestListItem>>> {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.vip) p.set("vip", opts.vip);
  if (opts.segment) p.set("segment", opts.segment);
  if (opts.blocked !== undefined) p.set("blocked", String(opts.blocked));
  const qs = p.toString() ? `?${p.toString()}` : "";
  return call<ListT<GuestListItem>>(qs);
}

export async function getGuest(id: string): Promise<Result<Guest>> {
  return call<Guest>(`/${id}`);
}

export async function createGuest(
  body: Partial<Guest>,
): Promise<Result<Guest>> {
  return call<Guest>("", { method: "POST", body });
}

export async function updateGuest(
  id: string,
  body: Partial<Guest>,
): Promise<Result<Guest>> {
  return call<Guest>(`/${id}`, { method: "PATCH", body });
}

export async function deleteGuest(
  id: string,
): Promise<Result<{ deleted?: boolean; anonymized?: boolean }>> {
  return call<{ deleted?: boolean; anonymized?: boolean }>(`/${id}`, {
    method: "DELETE",
  });
}

// --- Sub-Ressourcen ---------------------------------------------------------
export async function listAddresses(
  id: string,
): Promise<Result<ListT<GuestAddress>>> {
  return call<ListT<GuestAddress>>(`/${id}/addresses`);
}

export async function addAddress(
  id: string,
  body: Partial<GuestAddress>,
): Promise<Result<GuestAddress>> {
  return call<GuestAddress>(`/${id}/addresses`, { method: "POST", body });
}

export async function deleteAddress(
  id: string,
  addressId: string,
): Promise<Result<void>> {
  return call<void>(`/${id}/addresses/${addressId}`, { method: "DELETE" });
}

export async function listContacts(
  id: string,
): Promise<Result<ListT<GuestContact>>> {
  return call<ListT<GuestContact>>(`/${id}/contacts`);
}

export async function addContact(
  id: string,
  body: { type: string; value: string; is_primary?: boolean },
): Promise<Result<GuestContact>> {
  return call<GuestContact>(`/${id}/contacts`, { method: "POST", body });
}

export async function deleteContact(
  id: string,
  contactId: string,
): Promise<Result<void>> {
  return call<void>(`/${id}/contacts/${contactId}`, { method: "DELETE" });
}

export async function listIdentityDocs(
  id: string,
): Promise<Result<ListT<GuestIdentityDoc>>> {
  return call<ListT<GuestIdentityDoc>>(`/${id}/identity-documents`);
}

export async function addIdentityDoc(
  id: string,
  body: {
    doc_type: string;
    number: string;
    issuing_country?: string;
    valid_until?: string;
  },
): Promise<Result<GuestIdentityDoc>> {
  return call<GuestIdentityDoc>(`/${id}/identity-documents`, {
    method: "POST",
    body,
  });
}

export async function deleteIdentityDoc(
  id: string,
  docId: string,
): Promise<Result<void>> {
  return call<void>(`/${id}/identity-documents/${docId}`, { method: "DELETE" });
}

export async function getPreferences(
  id: string,
): Promise<Result<GuestPreferences>> {
  return call<GuestPreferences>(`/${id}/preferences`);
}

export async function savePreferences(
  id: string,
  body: Partial<GuestPreferences>,
): Promise<Result<GuestPreferences>> {
  return call<GuestPreferences>(`/${id}/preferences`, { method: "PUT", body });
}

export async function listConsents(
  id: string,
): Promise<Result<ListT<GuestConsent>>> {
  return call<ListT<GuestConsent>>(`/${id}/consents`);
}

export async function addConsent(
  id: string,
  body: { consent_type: string; status: string; source?: string },
): Promise<Result<GuestConsent>> {
  return call<GuestConsent>(`/${id}/consents`, { method: "POST", body });
}

export async function listNotes(id: string): Promise<Result<ListT<GuestNote>>> {
  return call<ListT<GuestNote>>(`/${id}/notes`);
}

export async function addNote(
  id: string,
  body: { body: string; category?: string },
): Promise<Result<GuestNote>> {
  return call<GuestNote>(`/${id}/notes`, { method: "POST", body });
}

export async function deleteNote(
  id: string,
  noteId: string,
): Promise<Result<void>> {
  return call<void>(`/${id}/notes/${noteId}`, { method: "DELETE" });
}

export async function listDocuments(
  id: string,
): Promise<Result<ListT<GuestDocument>>> {
  return call<ListT<GuestDocument>>(`/${id}/documents`);
}

export async function addDocument(
  id: string,
  body: { name: string; storage_path: string; doc_type?: string },
): Promise<Result<GuestDocument>> {
  return call<GuestDocument>(`/${id}/documents`, { method: "POST", body });
}

export async function deleteDocument(
  id: string,
  docId: string,
): Promise<Result<void>> {
  return call<void>(`/${id}/documents/${docId}`, { method: "DELETE" });
}

// --- Joins ------------------------------------------------------------------
export async function listGuestReservations(
  id: string,
): Promise<Result<ListT<GuestReservation>>> {
  return call<ListT<GuestReservation>>(`/${id}/reservations`);
}

export async function listGuestThreads(
  id: string,
): Promise<Result<ListT<GuestThread>>> {
  return call<ListT<GuestThread>>(`/${id}/threads`);
}

export async function listGuestInvoices(
  id: string,
): Promise<Result<ListT<GuestInvoice>>> {
  return call<ListT<GuestInvoice>>(`/${id}/invoices`);
}
