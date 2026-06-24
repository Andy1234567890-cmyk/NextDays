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
  // Optional: bestehenden Gast fest verknüpfen (z. B. aus der Gästekarte) —
  // Backend nutzt ihn statt einen neuen anzulegen (keine Dublette).
  guest_id?: string;
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
  total_amount: number | null; // null für Rollen ohne Finanz-/Vollzugriff (DSGVO-Split)
  currency: string;
  ota_name: string | null; // echter Portal-Name (Booking.com, Airbnb, Expedia …)
  external_ref: string | null; // OTA-Reservierungscode
  num_guests: number; // Gästezahl (Balken-Anzeige)
};

export type QuoteItem = { label: string; amount: number };

// Vollständige Detailansicht (rechter Slider). Beträge/Kontakt maskiert (null
// ohne Berechtigung).
export type ReservationDetail = {
  id: string;
  property_id: string;
  property_title: string;
  guest_id: string | null;
  guest_name: string;
  channel: ReservationChannel;
  ota_name: string | null;
  external_ref: string | null;
  external_url: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  status: ReservationStatus;
  num_guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  currency: string;
  total_amount: number | null;
  paid_amount: number | null;
  due_amount: number | null;
  quote_items: QuoteItem[];
  checkin_time: string | null;
  checkout_time: string | null;
  note: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_country: string | null;
  created_at: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
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

/** Reservierung verschieben (Objekt/Zeitraum) oder resizen (Check-in/out).
 *  Backend prüft erneut Double-Booking (409) und schreibt die Belegung um. */
export async function moveReservation(
  reservationId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/move`, {
    method: "PATCH",
    body: { property_id: propertyId, check_in: checkIn, check_out: checkOut },
  });
}

/** Vollständige Detailansicht einer Reservierung (rechter Slider). */
export async function getReservationDetail(
  reservationId: string,
): Promise<Result<ReservationDetail>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}`);
}

/** Reservierung stornieren — Begründung ist Pflicht (wird dokumentiert/auditiert).
 *  Kanal-agnostisch; gibt die belegten Tage frei. Eine lokale Storno hebt eine
 *  OTA-Buchung NICHT beim Portal auf (UI weist darauf hin). */
export async function cancelReservation(
  reservationId: string,
  reason: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

/** Reservierungen eines Objekts (oder alle, ohne propertyId). */
export async function listReservations(
  propertyId?: string,
): Promise<Result<{ items: Reservation[]; total: number }>> {
  const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  return call(`/reservations${qs}`);
}
