"use server";

// Reservierungen: Server-Actions gegen den FastAPI-reservations-Slice
// (/api/v1/reservations). Anlegen prüft im Backend Double-Booking und belegt
// die Kalendertage. Business-Logik bleibt im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type ReservationChannel = "direct" | "portal" | "booking" | "airbnb" | "vrbo";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type GuestBreakdown = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type GuestContact = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  language: string;
};

export type ReservationInput = {
  property_id: string;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD (exklusiv)
  channel: ReservationChannel;
  source: string;
  guests: GuestBreakdown;
  contact: GuestContact;
  total_amount: number;
  status: ReservationStatus;
};

export type Reservation = {
  id: string;
  property_id: string;
  guest_id: string | null;
  guest_name: string;
  channel: ReservationChannel;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  total_amount: number;
  currency: string;
  ota_name: string | null; // echter Portal-Name (Booking.com, Airbnb, Expedia …)
  external_ref: string | null; // OTA-Reservierungscode
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

// --- Dashboard --------------------------------------------------------------
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
  revenue_30d: DashboardKpi;
  confirmed_30d: DashboardKpi;
  currency: string;
};

/** Startseiten-Kennzahlen (echte Daten, im Backend berechnet). */
export async function getDashboard(): Promise<Result<Dashboard>> {
  return call("/reservations/dashboard");
}

/** Reservierung anlegen. Belegt im Backend die Kalendertage (booked). */
export async function createReservation(
  input: ReservationInput,
): Promise<Result<Reservation>> {
  return call("/reservations", { method: "POST", body: input });
}

/** Reservierungen eines Objekts (oder alle, ohne propertyId). */
export async function listReservations(
  propertyId?: string,
): Promise<Result<{ items: Reservation[]; total: number }>> {
  const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  return call(`/reservations${qs}`);
}
