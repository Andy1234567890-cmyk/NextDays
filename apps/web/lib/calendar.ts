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
  // CTA/CTD-Restriktionen je Tag (Default false ohne availability-Zeile).
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
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

/** Verfügbarkeit eines Objekts im Zeitraum [start, end). Daten als YYYY-MM-DD. */
export async function getAvailability(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<DayAvailability[]>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/availability?${qs.toString()}`);
}

// Ein Objekt im Batch-Board: Tagesdaten + Stop-Sells in einem Rutsch.
export type BoardProperty = {
  property_id: string;
  // Objekt-Währung (aus dem Rate-Plan) für die Tagespreis-Anzeige.
  currency: string | null;
  days: DayAvailability[];
  stop_sell: StopSellDay[];
};

/** Batch-Kalender: Verfügbarkeit + Preise + Min-Stay + Stop-Sell für ALLE
 *  Objekte im Zeitraum [start, end) in EINEM Call. Ersetzt die früheren
 *  2 Einzel-Calls je Objekt (N+1) — der Board-Endpunkt lädt serverseitig mit
 *  wenigen gebündelten Queries. Leere propertyIds → leeres Ergebnis. */
export async function getBoard(
  propertyIds: string[],
  start: string,
  end: string,
): Promise<Result<{ items: BoardProperty[] }>> {
  if (propertyIds.length === 0) return { ok: true, data: { items: [] } };
  const qs = new URLSearchParams({ start, end });
  for (const id of propertyIds) qs.append("property_ids", id);
  return call(`/calendar/board?${qs.toString()}`);
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

/** Manuelle Sperre im Zeitraum aufheben (gibt frei gewordene Tage an Channex
 *  zurück, gebuchte Tage bleiben unberührt). end ist exklusiv. */
export async function unblockRange(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ unblocked_days: number }>> {
  return call("/calendar/unblock", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end } },
  });
}

export type StopSellSource = "manual" | "channex";

export type StopSellScope = "all" | "channels";

export type StopSellDay = {
  id: string;
  property_id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  source: StopSellSource;
  // Kanal-Dimension (Migration 0145): all = alle Kanäle (Default), channels =
  // nur die in channels[] genannten (platform/reception/ota:<code>/ota:*).
  scope?: StopSellScope;
  channels?: string[];
  // Reisebüro/Veranstalter, an den sich der Stopp richtet (null = alle Kanäle).
  agency_id?: string | null;
  // Name des Reisebüros (Backend-Join) — fürs Balken-Label im Kalender.
  agency_name?: string | null;
};

/** Stop-Sell-Tage eines Objekts im Zeitraum [start, end). */
export async function listStopSell(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ items: StopSellDay[]; total: number }>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/stop-sell?${qs.toString()}`);
}

/** Stop-Sell für einen Zeitraum setzen (manuell). end exklusiv.
 *  weekdays (ISO: 0=Montag … 6=Sonntag) beschränkt optional auf Wochentage
 *  im Zeitraum (z. B. nur Wochenenden); wird auch an Channex durchgereicht. */
export async function setStopSell(
  propertyId: string,
  start: string,
  end: string,
  reason?: string,
  weekdays?: number[],
  agencyId?: string,
  // skipped_booked: gebuchte Tage im Zeitraum werden nie gestoppt (der Tag ist
  // bereits verkauft) und hier gemeldet, damit die UI die Überschneidung zeigt.
): Promise<Result<{ stopped_days: number; skipped_booked: number }>> {
  return call("/calendar/stop-sell", {
    method: "POST",
    body: {
      property_id: propertyId,
      range: { start, end },
      reason: reason ?? null,
      weekdays: weekdays ?? null,
      agency_id: agencyId ?? null,
    },
  });
}

/** Stop-Sell aufheben. end exklusiv. Standard: nur manuelle Stops (Portal-Stops
 *  bleiben). includePortal=true hebt AUCH Portal-/Channex-Stops auf und öffnet die
 *  Tage an den OTAs — für versehentlich gesetzte Stops. */
export async function clearStopSell(
  propertyId: string,
  start: string,
  end: string,
  weekdays?: number[],
  includePortal?: boolean,
): Promise<Result<{ status: string }>> {
  return call("/calendar/stop-sell/clear", {
    method: "POST",
    body: {
      property_id: propertyId,
      range: { start, end },
      weekdays: weekdays ?? null,
      include_portal: includePortal ?? false,
    },
  });
}

/** ALLE Stop-Sells (auch Portal) zurücksetzen. propertyId weglassen = alle
 *  Objekte des Tenants. Öffnet die Tage auch an den OTAs. */
export async function resetStopSell(
  propertyId?: string,
): Promise<Result<{ properties: number; days: number }>> {
  return call("/calendar/stop-sell/reset", {
    method: "POST",
    body: { property_id: propertyId ?? null },
  });
}

export type BulkEditInput = {
  property_ids: string[];
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  price?: number;
  price_adjust_pct?: number; // prozentual (z. B. +10 / -15); schließt price aus
  min_stay?: number;
  max_stay?: number; // Maximalaufenthalt (0 = keine Obergrenze)
  block?: boolean;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
};

export type BulkEditResult = {
  properties: number;
  days: number;
  applied: string[];
};

/** Bulk-Edit: Preis/Min-Stay/Sperre/Stop-Sell über mehrere Objekte ×
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

// -- Benannte Saisons (Jahres-Kalender, Drag&Drop) --------------------------
export type SeasonMode = "percent" | "fixed";

export type SeasonAssignment = {
  id: string;
  season_id: string;
  start_date: string; // YYYY-MM-DD (inklusiv)
  end_date: string; // YYYY-MM-DD (inklusiv)
};

export type Season = {
  id: string;
  property_id: string;
  name: string;
  color: string; // #RRGGBB
  mode: SeasonMode;
  amount: number; // percent: ±% auf Basispreis; fixed: Nachtpreis
  assignments: SeasonAssignment[];
};

/** Alle benannten Saisons eines Objekts inkl. Zeitraum-Zuweisungen. */
export async function listSeasons(
  propertyId: string,
): Promise<Result<{ items: Season[]; total: number }>> {
  return call(`/calendar/seasons?property_id=${encodeURIComponent(propertyId)}`);
}

/** Neue benannte Saison anlegen (Name, Farbe, Modus, Betrag). */
export async function createSeason(input: {
  property_id: string;
  name: string;
  color: string;
  mode: SeasonMode;
  amount: number;
}): Promise<Result<Season>> {
  return call("/calendar/seasons", { method: "POST", body: input });
}

/** Saison-Stammdaten ändern (rematerialisiert alle Zeiträume). */
export async function updateSeason(
  seasonId: string,
  patch: Partial<Pick<Season, "name" | "color" | "mode" | "amount">>,
): Promise<Result<Season>> {
  return call(`/calendar/seasons/${seasonId}`, { method: "PATCH", body: patch });
}

/** Saison löschen (zugewiesene Tage fallen auf den Basispreis zurück). */
export async function deleteSeason(
  seasonId: string,
): Promise<Result<{ deleted: boolean }>> {
  return call(`/calendar/seasons/${seasonId}`, { method: "DELETE" });
}

/** Einen Zeitraum einer Saison zuweisen. end exklusiv. */
export async function assignSeason(input: {
  property_id: string;
  season_id: string;
  start: string;
  end: string;
}): Promise<Result<{ days: number }>> {
  const { property_id, season_id, start, end } = input;
  return call("/calendar/seasons/assign", {
    method: "POST",
    body: { property_id, season_id, range: { start, end } },
  });
}

/** Eine Zeitraum-Zuweisung entfernen (Tage fallen auf Basispreis zurück). */
export async function unassignSeason(
  assignmentId: string,
): Promise<Result<{ removed: boolean }>> {
  return call(`/calendar/seasons/assign/${assignmentId}`, { method: "DELETE" });
}

// -- Mehrere Restriktions-Zeilen in EINEM Call (Zertifizierung Test 3-8) -----
export type RestrictionRow = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  price?: number;
  min_stay?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
};

/** Mehrere heterogene Restriktions-Zeilen (verschiedene Preise/min_stay/max_stay/
 *  CTA/CTD/stop_sell je Zeitraum) eines Objekts in EINEM Channex-Call setzen. */
export async function bulkRestrictions(
  propertyId: string,
  rows: RestrictionRow[],
): Promise<Result<{ rows: number }>> {
  return call("/calendar/bulk-restrictions", {
    method: "POST",
    body: {
      property_id: propertyId,
      rows: rows.map(({ start, end, ...rest }) => ({
        range: { start, end },
        ...rest,
      })),
    },
  });
}
