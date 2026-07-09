"use server";

// Gastmodul (Portal-Schalter je Objekt): Server-Actions gegen den FastAPI-
// property_portal-Slice (/api/v1/property-portal). Hält NUR die strukturierten
// Schalter/Werte (Self-Check-in, Türcode + Regeln, Kontakt, Kopfbild). Die
// Info-TEXTE (WLAN/Türzugang) leben in properties.type_attributes.messaging und
// laufen über updateProperty — bewusst getrennt (eine Wahrheit je Datenart,
// siehe docs/ANALYSE-gaeste-info-gastmodul-gaestemappe.md).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type GuestPortalSettings = {
  enabled: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  self_checkin: boolean;
  // Türcode: null ohne MANAGE_PROPERTIES (Backend maskiert).
  door_code: string | null;
  show_code_only_if_paid: boolean;
  hide_code_until_checkin: boolean;
  code_visible_from: string | null; // „HH:MM"
  maintenance_phone: string | null;
  header_image_path: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PUT"; body?: unknown } = {},
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

/** Gastmodul-Einstellungen eines Objekts laden. */
export async function getGuestPortal(
  propertyId: string,
): Promise<Result<GuestPortalSettings>> {
  return call(`/property-portal/${encodeURIComponent(propertyId)}/guest-portal`);
}

/** Gastmodul-Einstellungen speichern (upsert). */
export async function saveGuestPortal(
  propertyId: string,
  settings: GuestPortalSettings,
): Promise<Result<GuestPortalSettings>> {
  return call(`/property-portal/${encodeURIComponent(propertyId)}/guest-portal`, {
    method: "PUT",
    body: settings,
  });
}
