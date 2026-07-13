// Reservierungen — gegen den FastAPI-reservations-Slice (/api/v1/reservations),
// gespiegelt aus apps/web/lib/reservations.ts. Nur Lesepfade + Detail für die
// Mobile-App.
//
// Maskierung (DSGVO-Daten-Split §4): das Backend liefert je nach Berechtigung
// bereits maskierte Werte — total_amount/paid_amount = null OHNE Betrags-Sicht,
// guest_name nur Vorname OHNE VIEW_GUEST_FULL, ota_name = null OHNE
// Quellen-Sicht. Diese null bleiben null; die App füllt NICHTS auf und rendert
// null als „—" (nie 0/Fantasiewert).
import { call, type Result } from "@/lib/api";

export type ReservationChannel = "direct" | "portal" | "booking" | "airbnb" | "vrbo";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type Reservation = {
  id: string;
  property_id: string;
  guest_id: string | null;
  guest_name: string; // voll oder nur Vorname (Maskierung im Backend)
  channel: ReservationChannel;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD (exklusiv)
  status: ReservationStatus;
  total_amount: number | null; // null ohne Betrags-Sicht — NICHT auffüllen
  paid_amount: number | null; // null ohne Betrags-Sicht
  currency: string;
  ota_name: string | null; // null ohne Quellen-Sicht
  external_ref: string | null;
  num_guests: number;
  adults: number;
  children: number;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

export type ReservationListResponse = { items: Reservation[]; total: number };

// Detail. Beträge maskiert (null ohne Berechtigung). Nur die Felder, die die
// App aktuell rendert — exakt am Backend-Contract (ReservationDetail), keine
// erfundenen (z. B. kein email/phone: Kontakt liegt nicht in diesem Contract).
export type ReservationDetail = {
  id: string;
  property_id: string;
  property_title: string;
  property_city: string | null;
  property_country: string | null;
  guest_name: string; // voll oder nur Vorname (Maskierung)
  channel: ReservationChannel;
  ota_name: string | null;
  external_ref: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  status: ReservationStatus;
  num_guests: number;
  adults: number;
  children: number;
  currency: string;
  total_amount: number | null; // null ohne Betrags-Sicht
  paid_amount: number | null;
  due_amount: number | null;
  note: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

/** Reservierungen des Tenants (optional nach Objekt gefiltert). */
export async function listReservations(
  propertyId?: string,
): Promise<Result<ReservationListResponse>> {
  const q = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  return call(`/reservations${q}`);
}

/** Vollständige Detailansicht einer Reservierung. */
export async function getReservationDetail(
  reservationId: string,
): Promise<Result<ReservationDetail>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}`);
}
