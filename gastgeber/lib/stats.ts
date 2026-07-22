// Data-Layer Kennzahlen (reservations/stats) fürs Dashboard-Home. Über den DAL
// api-server.ts. Der tenant-weite /reservations/stats-Endpunkt liefert die KPIs
// als DashboardKpi (value + change_pct) für den gewählten Zeitraum.
import { api } from "./api-server";

export interface Kpi {
  value: number;
  change_pct: number | null;
}

export interface TenantStats {
  property_title: string;
  currency: string;
  revenue: Kpi | null;
  payments_received: Kpi | null;
  occupancy_rate: Kpi;
  created_reservations: Kpi;
  hosted_guests: Kpi;
  booked_nights: Kpi;
}

/** Tenant-weite Kennzahlen (default-Zeitraum des Backends: letzte 30 Tage). */
export async function getTenantStats(): Promise<TenantStats> {
  return api<TenantStats>("/reservations/stats");
}
