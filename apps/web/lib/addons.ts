"use server";

// Zusatzleistungen/Upsells: Server-Actions gegen den FastAPI-addons-Slice
// (/api/v1/addons). Katalog-CRUD je Objekt + Medien-Upload. Business-Logik
// (Preis nach Basis, Verkaufsflächen, Zahlstatus) liegt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AddonBasis = "per_stay" | "per_night" | "per_guest" | "per_unit";
export type AddonSurface = "booking_engine" | "guest_portal" | "checkin";
export type AddonAvailability = "before_checkin" | "anytime";

export type Addon = {
  id: string;
  property_id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  media: string[];
  price: number;
  basis: AddonBasis;
  mandatory: boolean;
  appears_in: AddonSurface[];
  available_until: AddonAvailability;
  tax_rate: number | null;
  active: boolean;
  sort_order: number;
};

export type AddonInput = {
  name?: Record<string, string>;
  description?: Record<string, string>;
  media?: string[];
  price?: number;
  basis?: AddonBasis;
  mandatory?: boolean;
  appears_in?: AddonSurface[];
  available_until?: AddonAvailability;
  tax_rate?: number | null;
  active?: boolean;
  sort_order?: number;
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
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Alle Zusatzleistungen eines Objekts (Katalog, inkl. inaktiver). */
export async function listAddons(
  propertyId: string,
): Promise<Result<{ items: Addon[]; total: number }>> {
  return call(`/addons/properties/${propertyId}`);
}

export async function createAddon(
  propertyId: string,
  input: AddonInput,
): Promise<Result<Addon>> {
  return call(`/addons/properties/${propertyId}`, {
    method: "POST",
    body: input,
  });
}

export async function updateAddon(
  addonId: string,
  input: AddonInput,
): Promise<Result<Addon>> {
  return call(`/addons/${addonId}`, { method: "PATCH", body: input });
}

export async function deleteAddon(addonId: string): Promise<Result<null>> {
  return call(`/addons/${addonId}`, { method: "DELETE" });
}

/** Ein Medium (Foto) hochladen (multipart) → aktualisiertes Add-on.
 *  JPEG/PNG/WebP, 10 KB–20 MB, max. 5 (serverseitig validiert). */
export async function uploadAddonMedia(
  addonId: string,
  file: File,
): Promise<Result<Addon>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1/addons/${addonId}/media`, {
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
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as Addon };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}
