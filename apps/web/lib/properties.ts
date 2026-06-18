"use server";

// Objekt-Verwaltung: Server-Actions gegen den FastAPI-properties-Slice
// (/api/v1/properties). Business-Logik bleibt im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type PropertyType =
  | "ferienhaus"
  | "appartement"
  | "glamping"
  | "tiny_house"
  | "stellplatz"
  | "hausboot";

export type PropertyStatus = "draft" | "active" | "inactive";

export type Property = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  property_type: PropertyType;
  status: PropertyStatus;
  max_guests: number;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  amenities: string[];
  photos: string[];
  // Flexible Sektionen (Rooms, Sleeping arrangements, m², Einheiten …).
  type_attributes: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type PropertyInput = Partial<
  Omit<Property, "id" | "tenant_id" | "created_at" | "updated_at">
> & { title?: string };

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

export async function listProperties(): Promise<
  Result<{ items: Property[]; total: number }>
> {
  return call("/properties");
}

export async function getProperty(id: string): Promise<Result<Property>> {
  return call(`/properties/${id}`);
}

export async function createProperty(
  input: PropertyInput,
): Promise<Result<Property>> {
  return call("/properties", { method: "POST", body: input });
}

export async function updateProperty(
  id: string,
  input: PropertyInput,
): Promise<Result<Property>> {
  return call(`/properties/${id}`, { method: "PATCH", body: input });
}

export async function deleteProperty(id: string): Promise<Result<null>> {
  return call(`/properties/${id}`, { method: "DELETE" });
}

// Bild für ein Objekt hochladen (multipart) → öffentliche URL. `slot` benennt
// die Verwendung (z. B. „custom-map"), feste Namen überschreiben das Vorbild.
export async function uploadPropertyImage(
  id: string,
  file: File,
  slot = "image",
): Promise<Result<{ url: string }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(
      `${base}/api/v1/properties/${id}/image?slot=${encodeURIComponent(slot)}`,
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
    return { ok: true, data: (await res.json()) as { url: string } };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}
