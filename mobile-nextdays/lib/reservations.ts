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
  // Eigentümer-Aufenthalt (Migration 0241): kein Umsatz, keine Herkunft —
  // die Liste kennzeichnet ihn statt einen Vertriebskanal zu zeigen.
  is_owner_stay: boolean;
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
  infants: number;
  pets: number;
  currency: string;
  total_amount: number | null; // null ohne Betrags-Sicht
  paid_amount: number | null;
  due_amount: number | null;
  // Aufschlüsselung des Preises (Quote-Zeilen). Leer, wenn der Betrag manuell
  // gesetzt wurde — dann gibt es schlicht keine Zeilen, keine erfundenen.
  quote_items: QuoteItem[];
  // Vereinbarte An-/Abreisezeit des Objekts. null = nicht hinterlegt; die App
  // erfindet KEINE Standardzeit (Wurzel 4).
  checkin_time: string | null;
  checkout_time: string | null;
  note: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  // Eigentümer-Aufenthalt (Migration 0241): sperrt den Kalender wie jede
  // Buchung, ist aber kein Umsatz — die UI kennzeichnet ihn und zeigt keine
  // Beträge, weil es dort keine gibt.
  is_owner_stay: boolean;
};

// Eine Preiszeile aus dem Quote. EXAKT der Contract
// (reservations/schemas.py QuoteItem) — der trägt nur Label und Betrag; die in
// der DB zusätzlich gespeicherten Felder (kind, tax_rate) gibt der Endpoint
// nicht heraus und werden hier deshalb auch nicht behauptet.
export type QuoteItem = {
  label: string;
  amount: number;
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
