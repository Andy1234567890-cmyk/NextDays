// Belegungs-/Verfügbarkeitsdaten — gegen den FastAPI-calendar-Slice
// (GET /api/v1/calendar/availability). Typen exakt am Pydantic-Contract
// (apps/api/src/features/calendar/schemas.py → DayAvailability); nullable bleibt
// nullable (price = null ohne Rate-Plan → kein Fallback-Wert, Wurzel 4).
import { call, type Result } from "@/lib/api";

export type AvailabilityStatus = "open" | "booked" | "blocked";
export type AvailabilitySource =
  | "direct"
  // Eigene Website des Betriebs (0380) — provisionsfreier Direktumsatz,
  // getrennt von "direct" (Telefon/E-Mail/vor Ort).
  | "website"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  // Sammelkanal für OTAs ohne eigenen Wert (Expedia, Agoda, Namensvarianten).
  | "ota_other"
  | "manual"
  // Sperre aus einem abonnierten Fremdkalender (iCal-Import).
  | "ical"
  // Sperre, weil der Vermarktungsvertrag zu diesem Objekt endet (0355). Kein
  // Vertriebskanal, sondern eine Herkunft wie "manual"/"ical".
  | "contract_end";

export type DayAvailability = {
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  source: AvailabilitySource;
  // Tagespreis (Resolver override>dynamic>weekday>base); null ohne Rate-Plan.
  price: number | null;
  price_source: string; // override | dynamic | weekday | base | none
  price_factors: Record<string, number> | null;
  min_stay: number | null;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
};

/**
 * Tagesbelegung eines Objekts im Zeitraum [start, end) (end exklusiv, wie der
 * Backend-Contract: der Check-out-Tag ist wieder frei).
 */
export async function getAvailability(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<DayAvailability[]>> {
  const p = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/availability?${p.toString()}`);
}

// Stop-Sell-Tag (gesperrt für Verkauf) — Balken/Marker im Kalender.
export type StopSellDay = {
  id: string;
  property_id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  source: "manual" | "channex";
  agency_id: string | null;
  agency_name: string | null;
};

// Ein Objekt im Batch-Kalender (BoardProperty). Die Währung kommt aus dem
// Rate-Plan des Objekts (nicht aus type_attributes/Reservierungen) — Objekte
// ohne Buchung haben sonst keine Währung. null ohne Betrags-Sicht (owner).
export type BoardProperty = {
  property_id: string;
  currency: string | null;
  days: DayAvailability[];
  stop_sell: StopSellDay[];
};

export type BoardResponse = { items: BoardProperty[] };

/**
 * Batch-Kalender für mehrere Objekte in EINEM Call: Tagesdaten + Preise +
 * Min-Stay + Stop-Sell + Objekt-Währung (wie das Web-Board). end exklusiv.
 */
export async function getBoard(
  propertyIds: string[],
  start: string,
  end: string,
): Promise<Result<BoardResponse>> {
  const p = new URLSearchParams({ start, end });
  for (const id of propertyIds) p.append("property_ids", id);
  return call(`/calendar/board?${p.toString()}`);
}
