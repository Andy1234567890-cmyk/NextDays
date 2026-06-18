"use server";

// Kalender: Server-Actions gegen den FastAPI-calendar-Slice
// (/api/v1/calendar). Liefert die Verfügbarkeit pro Objekt + Zeitraum und
// erlaubt Sperren. Business-Logik (Double-Booking-Schutz) liegt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AvailabilityStatus = "open" | "booked" | "blocked";
export type AvailabilitySource =
  | "direct"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  | "manual";

export type DayAvailability = {
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  source: AvailabilitySource;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
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

/** Verfügbarkeit eines Objekts im Zeitraum [start, end). Daten als YYYY-MM-DD. */
export async function getAvailability(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<DayAvailability[]>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/availability?${qs.toString()}`);
}

/** Zeitraum sperren (manuell). end ist exklusiv. */
export async function blockRange(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ blocked_days: number }>> {
  return call("/calendar/block", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end } },
  });
}
