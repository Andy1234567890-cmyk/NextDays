// Startseiten-Kennzahlen der Agentur-Übersicht — gegen den FastAPI-Endpoint
// GET /api/v1/reservations/dashboard (dieselbe Quelle wie die Web-App:
// apps/web/lib/reservations.ts → getDashboard). Business-Logik/Aggregation
// bleibt im Backend. Typen exakt am Pydantic-Contract
// (apps/api/src/features/reservations/schemas.py → DashboardResponse) — nullable
// bleibt nullable (revenue_30d = null ohne Betrags-Sichtbarkeit, §4.2).
import { call, type Result } from "@/lib/api";

export type ReservationChannel = "direct" | "portal" | "booking" | "airbnb" | "vrbo";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

// Eine Zeile in den Anreise-/Abreise-/Anstehend-Listen.
export type DashboardEntry = {
  reservation_id: string;
  guest_name: string;
  property_title: string;
  channel: ReservationChannel;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
};

// Eine KPI-Kachel mit Vergleich zur Vorperiode. change_pct null = keine
// Vorperiode (kein erfundener 0-%-Wert).
export type DashboardKpi = {
  value: number;
  change_pct: number | null;
};

export type Dashboard = {
  today: string;
  checkouts_today: DashboardEntry[];
  checkins_today: DashboardEntry[];
  upcoming: DashboardEntry[];
  checkins_30d: DashboardKpi;
  // null, wenn der Nutzer keine Beträge sehen darf (§4.2) — Umsatz-Kachel wird
  // dann nicht gerendert (kein erfundener 0-Betrag).
  revenue_30d: DashboardKpi | null;
  confirmed_30d: DashboardKpi;
  currency: string;
};

/** Übersicht: heutige An-/Abreisen + KPIs (Belegung/Umsatz). */
export async function getDashboard(): Promise<Result<Dashboard>> {
  return call("/reservations/dashboard");
}
