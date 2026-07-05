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
  // Echter Check-in/Check-out-Zustand (0091) — null = noch nicht erfolgt.
  checked_in_at: string | null;
  checked_out_at: string | null;
};

export type QuoteItem = { label: string; amount: number };

// Aktive Rechnung zur Buchung (Beträge null ohne Betrags-Sichtbarkeit).
export type ReservationInvoiceInfo = {
  id: string;
  invoice_number: string | null;
  status: string;
  gross_amount: number | null;
  currency: string;
};

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
  // Echter Check-in/Check-out-Zustand (0091) — null = noch nicht erfolgt.
  checked_in_at: string | null;
  checked_out_at: string | null;
  // Aktive Rechnung zur Buchung (Booking→Invoice-Brücke 0092), null = keine.
  invoice: ReservationInvoiceInfo | null;
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
  // null, wenn der Nutzer keine Beträge sehen darf (Owner ohne PM_BOOKING_TOTAL,
  // Daten-Split §4.2) — die Umsatz-Kachel wird dann nicht gerendert.
  revenue_30d: DashboardKpi | null;
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

/** Gast einchecken (setzt checked_in_at; nur bestätigte Buchungen). */
export async function checkInReservation(
  reservationId: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/check-in`, {
    method: "POST",
  });
}

export type CheckOutResult = {
  reservation: Reservation;
  invoice_id: string;
  invoice_number: string | null;
  invoice_already_existed: boolean;
};

// Zahlart des Gastes (Rezeptions-Abfrage beim Check-out): bar/Karte = am
// Empfang bezahlt → Rechnung sofort 'paid'; invoice = Zahlung auf Rechnung.
export type CheckOutPayment = {
  payment_method: "cash" | "card" | "invoice";
  card_brand?: string;
};

/** Gast auschecken — erzeugt serverseitig verpflichtend die finale Rechnung
 *  (GoBD-Nummer); schlägt die Rechnung fehl, findet KEIN Check-out statt. */
export async function checkOutReservation(
  reservationId: string,
  payment: CheckOutPayment,
): Promise<Result<CheckOutResult>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/check-out`, {
    method: "POST",
    body: payment,
  });
}

/** Reservierungen eines Objekts (oder alle, ohne propertyId). */
export async function listReservations(
  propertyId?: string,
): Promise<Result<{ items: Reservation[]; total: number }>> {
  const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  return call(`/reservations${qs}`);
}
