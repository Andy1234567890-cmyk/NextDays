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
  price: number | null; // Tagespreis (Override > dynamic > weekday > base); null ohne Rate-Plan
  // Herkunft des Preises: override | dynamic | weekday | base | none.
  price_source?: string;
  // Faktor-Aufschlüsselung bei dynamischem Preis ({faktor: multiplikator}) für
  // den „Warum dieser Preis?"-Tooltip. Nur bei price_source=dynamic gesetzt.
  price_factors?: Record<string, number> | null;
  min_stay: number | null; // Mindestaufenthalt aus dem Rate-Plan
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

export type StopSellSource = "manual" | "channex";

export type StopSellDay = {
  id: string;
  property_id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  source: StopSellSource;
};

/** Verkaufsstopp-Tage eines Objekts im Zeitraum [start, end). */
export async function listStopSell(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ items: StopSellDay[]; total: number }>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/stop-sell?${qs.toString()}`);
}

/** Verkaufsstopp für einen Zeitraum setzen (manuell). end exklusiv. */
export async function setStopSell(
  propertyId: string,
  start: string,
  end: string,
  reason?: string,
): Promise<Result<{ stopped_days: number }>> {
  return call("/calendar/stop-sell", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end }, reason: reason ?? null },
  });
}

/** Manuellen Verkaufsstopp aufheben (Channex-Stops bleiben). end exklusiv. */
export async function clearStopSell(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ status: string }>> {
  return call("/calendar/stop-sell/clear", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end } },
  });
}

export type BulkEditInput = {
  property_ids: string[];
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  price?: number;
  price_adjust_pct?: number; // prozentual (z. B. +10 / -15); schließt price aus
  min_stay?: number;
  block?: boolean;
  stop_sell?: boolean;
};

export type BulkEditResult = {
  properties: number;
  days: number;
  applied: string[];
};

/** Bulk-Edit: Preis/Min-Stay/Sperre/Verkaufsstopp über mehrere Objekte ×
 *  Zeitraum in einem Rutsch (Hostaway-Stil). Nur gesetzte Felder wirken. */
export async function bulkEdit(
  input: BulkEditInput,
): Promise<Result<BulkEditResult>> {
  const { property_ids, start, end, ...rest } = input;
  return call("/calendar/bulk-edit", {
    method: "POST",
    body: { property_ids, range: { start, end }, ...rest },
  });
}

export type SeasonPriceDay = { date: string; price: number };

/** Saison-/Tagespreise eines Objekts im Zeitraum [start, end). */
export async function listSeasonPrices(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ items: SeasonPriceDay[]; total: number }>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/season-price?${qs.toString()}`);
}

/** Tagespreis für einen Zeitraum setzen (Saisonpreis). end exklusiv.
 *  Schreibt price_overrides und pusht den Preis an Channex. */
export async function setSeasonPrice(
  propertyId: string,
  start: string,
  end: string,
  price: number,
): Promise<Result<{ days: number }>> {
  return call("/calendar/season-price", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end }, price },
  });
}
