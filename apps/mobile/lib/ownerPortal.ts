// Eigentümer-Portal — gegen den FastAPI-public_portal-Slice
// (/api/v1/public-portal). Typen exakt am Pydantic-Contract
// (apps/api/src/features/public_portal/schemas.py). Der eingeloggte Owner
// (Tenant-Auth, Rolle owner) sieht NUR seine zugeordneten Objekte; Beträge sind
// serverseitig maskiert (payout/price = null ohne Beträge-Sicht → als „—"
// rendern, NIE 0, Wurzel 4). Datenzugriff ausschließlich über lib/api.ts.
import { call, type Result } from "@/lib/api";

// --- Objekte ---------------------------------------------------------------

export type PortalProperty = {
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
};

export async function getOwnerProperties(): Promise<
  Result<{ items: PortalProperty[]; total: number }>
> {
  return call("/public-portal/properties");
}

// --- Kalender (read-only, maskiert) ----------------------------------------

export type PortalCalendarDay = {
  date: string; // YYYY-MM-DD
  status: string; // open | booked | blocked
  // Netto-Preis/Nacht; null ohne Beträge-Sicht (kein Fallback).
  price: number | null;
};

export async function getOwnerCalendar(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ property_id: string; days: PortalCalendarDay[] }>> {
  const p = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/public-portal/calendar?${p.toString()}`);
}

// --- Earnings (maskiert) ----------------------------------------------------

export type PortalEarningsItem = {
  property_id: string;
  title: string;
  nights: number;
  reservations: number;
  // null ohne Beträge-Sicht (kein Fallback).
  payout: number | null;
  currency: string;
};

export type PortalEarnings = {
  period_from: string;
  period_to: string;
  items: PortalEarningsItem[];
  total_payout: number | null;
  currency: string;
};

export async function getOwnerEarnings(
  periodFrom: string,
  periodTo: string,
): Promise<Result<PortalEarnings>> {
  const p = new URLSearchParams({ period_from: periodFrom, period_to: periodTo });
  return call(`/public-portal/earnings?${p.toString()}`);
}

// --- Statements (eigene, finalisiert) --------------------------------------

export type PortalStatement = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  owner_payout: number;
  currency: string;
  invoice_number: string | null;
  created_at: string | null;
};

export async function getOwnerStatements(): Promise<
  Result<{ items: PortalStatement[]; total: number }>
> {
  return call("/public-portal/statements");
}

// --- Sperr-Anfragen ---------------------------------------------------------

export type BlockRequest = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string | null;
};

export async function getBlockRequests(): Promise<
  Result<{ items: BlockRequest[]; total: number }>
> {
  return call("/public-portal/block-requests");
}

export async function createBlockRequest(input: {
  property_id: string;
  start_date: string;
  end_date: string;
}): Promise<Result<BlockRequest>> {
  return call("/public-portal/block-requests", { method: "POST", body: input });
}

// --- Zählerstände -----------------------------------------------------------

export type MeterReading = {
  id: string;
  property_id: string;
  meter_kind: string;
  value: number;
  read_at: string;
  created_at: string | null;
};

export async function getMeterReadings(
  propertyId: string,
): Promise<Result<{ items: MeterReading[]; total: number }>> {
  const p = new URLSearchParams({ property_id: propertyId });
  return call(`/public-portal/meter-readings?${p.toString()}`);
}

export async function createMeterReading(input: {
  property_id: string;
  meter_kind: string;
  value: number;
  read_at: string;
}): Promise<Result<MeterReading>> {
  return call("/public-portal/meter-readings", { method: "POST", body: input });
}
