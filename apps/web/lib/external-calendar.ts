"use server";

// Externe iCal-Kalender (Belegungs-Sync) — Server-Actions gegen den FastAPI-
// external_calendar-Slice (/api/v1/external-calendar). Der Kunde abonniert pro
// Objekt externe .ics-Feeds (Airbnb/Booking/Vrbo/Google), der
// Belegungskalender bleibt synchron. Kein Datenimport. JWT + MANAGE_CALENDAR.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/external-calendar${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export type ExternalCalendar = {
  id: string;
  property_id: string;
  name: string;
  ical_url: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_event_count: number | null;
};

export type PropertyCalendars = {
  property_id: string;
  title: string;
  status: string | null;
  calendars: ExternalCalendar[];
};

/** Zentrale Umzugs-Übersicht: alle Objekte + ihre externen Kalender. */
export async function overviewExternalCalendars(): Promise<
  Result<PropertyCalendars[]>
> {
  return call<PropertyCalendars[]>("/overview");
}

export async function listExternalCalendars(
  propertyId: string,
): Promise<Result<ExternalCalendar[]>> {
  return call<ExternalCalendar[]>(`/property/${propertyId}`);
}

export async function addExternalCalendar(input: {
  propertyId: string;
  name: string;
  icalUrl: string;
}): Promise<Result<ExternalCalendar>> {
  return call<ExternalCalendar>("", {
    method: "POST",
    body: { property_id: input.propertyId, name: input.name, ical_url: input.icalUrl },
  });
}

export async function syncExternalCalendar(
  calendarId: string,
): Promise<Result<ExternalCalendar>> {
  return call<ExternalCalendar>(`/${calendarId}/sync`, { method: "POST" });
}

export async function removeExternalCalendar(
  calendarId: string,
): Promise<Result<null>> {
  return call<null>(`/${calendarId}`, { method: "DELETE" });
}

// --- Export (eigener .ics-Feed pro Objekt) ---------------------------------

export type ExportToken = { property_id: string; token: string };

/** Export-Token des Objekts sicherstellen (idempotent) — für die Feed-URL. */
export async function ensureExportToken(
  propertyId: string,
): Promise<Result<ExportToken>> {
  return call<ExportToken>(`/export/${propertyId}/token`, { method: "POST" });
}

/** Export-Token neu vergeben — macht die alte Feed-URL sofort ungültig. */
export async function rotateExportToken(
  propertyId: string,
): Promise<Result<ExportToken>> {
  return call<ExportToken>(`/export/${propertyId}/rotate`, { method: "POST" });
}

/** Öffentliche .ics-Feed-URL aus einem Export-Token bauen. Der Kunde trägt sie
 *  in externe Kalender (Airbnb/Booking/Google) ein. `scope="upcoming"` blendet
 *  Vergangenes aus (Lodgify „nur zukünftige Reservierungen"). */
export async function exportFeedUrl(
  token: string,
  scope: "all" | "upcoming" = "all",
): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const q = scope === "upcoming" ? "?scope=upcoming" : "";
  return `${base}/api/v1/external-calendar/export/${token}.ics${q}`;
}
