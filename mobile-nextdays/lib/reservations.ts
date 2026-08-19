// Reservierungen — gegen den FastAPI-reservations-Slice (/api/v1/reservations),
// gespiegelt aus apps/web/lib/reservations.ts: Liste, vollständiges Detail und
// die Front-Desk-Aktionen (Check-in, Check-out, Anfrage annehmen/ablehnen,
// Storno).
//
// Maskierung (DSGVO-Daten-Split §4): das Backend liefert je nach Berechtigung
// bereits maskierte Werte — total_amount/paid_amount = null OHNE Betrags-Sicht,
// guest_name nur Vorname OHNE VIEW_GUEST_FULL, ota_name = null OHNE
// Quellen-Sicht. Diese null bleiben null; die App füllt NICHTS auf und rendert
// null als „—" (nie 0/Fantasiewert).
import { call, type Result } from "@/lib/api";

// Spiegelt apps/api/.../reservations/schemas.py:ReservationChannel.
// „ota_other" = Sammelkanal für OTAs ohne eigenen Wert (Expedia, Agoda …).
export type ReservationChannel =
  | "direct"
  // Eigene Website des Betriebs (0380) — provisionsfrei wie „direct", aber
  // getrennt auswertbar.
  | "website"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  | "ota_other";
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

// Eine Preiszeile des Angebots.
// Detail — VOLLSTÄNDIG am Backend-Contract (schemas.py:ReservationDetail).
// Beträge/Kontakt maskiert (null ohne Berechtigung).
//
// Der Typ war bis August 2026 ein Ausschnitt: Rechnung, Gast-Kontakt,
// Storno-Dokumentation, Portal-Konditionen, Nachrichten-Thread und der
// Buchungszeitpunkt fehlten. Da ein fehlendes Feld hier kein Kompilierfehler
// ist, sondern eine unsichtbare Lücke in der Oberfläche, steht der Contract
// jetzt komplett da.
export type ReservationInvoiceInfo = {
  id: string;
  invoice_number: string | null;
  status: string;
  // null ohne Betrags-Sichtbarkeit (dieselbe Maskierung wie total_amount).
  gross_amount: number | null;
  currency: string;
};

export type ReservationDetail = {
  id: string;
  property_id: string;
  property_title: string;
  // Standort des Objekts. lat/lng null = kein Punkt bekannt → keine Karte,
  // nur Text (kein erfundener Ort, Wurzel 4).
  property_street: string | null;
  property_postal_code: string | null;
  property_city: string | null;
  property_country: string | null;
  property_lat: number | null;
  property_lng: number | null;
  guest_id: string | null;
  guest_name: string; // voll oder nur Vorname (Maskierung)
  channel: ReservationChannel;
  ota_name: string | null;
  external_ref: string | null;
  // Die Buchung beim Portal (Deep-Link). null = keiner geliefert → kein Knopf.
  external_url: string | null;
  // Zahlungsweg laut Portal (0240): 'property' = wir ziehen ein, 'ota' = das
  // Portal hat schon kassiert, null = nicht geliefert (NICHT „wir").
  payment_collect: string | null;
  payment_method_ota: string | null;
  // Vom Portal einbehaltene Provision bzw. Steuern (0270) in Buchungswährung.
  ota_commission: number | null;
  ota_withheld_taxes: number | null;
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
  // Aktive Rechnung zur Buchung (0092). null = noch keine erstellt.
  invoice: ReservationInvoiceInfo | null;
  // Storno-Dokumentation (gesetzt bei status='cancelled').
  cancel_reason: string | null;
  cancelled_at: string | null;
  // Gast-Kontakt (maskiert — null ohne Kontakt-Sicht).
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_country: string | null;
  // UNSER Anlagezeitpunkt. NICHT der Buchungszeitpunkt des Gastes (Wurzel 5b) —
  // die Oberfläche beschriftet beide unterschiedlich.
  created_at: string | null;
  // Storno-Staffel des PORTALS (0384): für eine OTA-Buchung gilt, was
  // Booking/Airbnb dem Gast zugesagt hat. null = das Portal hat keine
  // geliefert (das heißt NICHT „kostenfrei stornierbar").
  // Eine Stufe: ab `from` kostet der Storno `amount`. Beträge kommen aus dem
  // Portal-JSON als String ("4268.00") ODER als Zahl — beides muss der
  // Aufrufer aushalten, umrechnen tut es niemand für uns.
  ota_cancel_penalties:
    | { from: string; amount: string | number | null; currency: string | null }[]
    | null;
  ota_notes: string | null;
  // Roh-Angaben des Portals (Verpflegung, Hausregeln des Portals, Gast-Labels,
  // angekündigte Ankunftszeit). Struktur gehört dem Portal, nicht uns.
  ota_details: {
    rooms?: { policies?: string; meal_plan?: string; children_ages?: number[] }[];
    guest_labels?: string[];
    arrival_hour?: string;
  } | null;
  // Buchungszeitpunkt beim Portal (0291, Wurzel 5b). null = die Quelle hat ihn
  // nicht geliefert; dann steht dort nichts, nicht `created_at`.
  booked_at: string | null;
  // Ablage (0383) — abgelegte Buchungen bleiben lesbar.
  archived_at: string | null;
  // Der Nachrichten-Thread dieser Buchung im Posteingang. null = keine
  // Korrespondenz → kein Weg dorthin (kein Knopf ohne Ziel, Wurzel 4).
  message_thread_id: string | null;
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

// --- Front-Desk-Aktionen ----------------------------------------------------
// Dieselben Endpunkte und dieselben Regeln wie im Web-Slider. Alle verlangen
// serverseitig MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS; die App prüft dieselbe
// Fähigkeit VOR dem Anzeigen des Knopfes — das ist Darstellung, nicht Schutz
// (Wurzel 9: der Server prüft ohnehin erneut).

/** Zahlart beim Check-out (Rezeptions-Abfrage). */
export type CheckOutPayment = {
  // cash/card = am Empfang bezahlt → Rechnung sofort 'paid';
  // invoice = auf Rechnung (Überweisung) → 'finalized'.
  payment_method: "cash" | "card" | "invoice";
  // Nur bei Karte (Visa, Mastercard …); sonst null.
  card_brand?: string | null;
};

/** Ergebnis des Check-outs: die dabei erzeugte finale Rechnung. */
export type CheckOutResult = {
  reservation: Reservation;
  invoice_id: string;
  invoice_number: string | null;
  // true beim idempotenten Wiederholen (Wurzel 2): es wurde keine zweite
  // Rechnung erzeugt, die bestehende gilt.
  invoice_already_existed: boolean;
};

/**
 * Grund-Codes des Stornos (Backend-Enum CancelReasonCode). Der Freitext bleibt
 * die Pflichtangabe; der Code ist eine zusätzliche, auswertbare Angabe.
 */
export type CancelReasonCode =
  | "guest_request"
  | "no_show"
  | "payment_failed"
  | "overbooking"
  | "property_issue"
  | "force_majeure"
  | "other";

/** Gast einchecken (setzt checked_in_at, 0091). */
export async function checkInReservation(
  reservationId: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/check-in`, {
    method: "POST",
  });
}

/**
 * Gast auschecken. Erzeugt serverseitig VERPFLICHTEND die finale Rechnung —
 * schlägt sie fehl (z. B. fehlender Steuersatz), bleibt der Gast eingecheckt
 * und der Fehler kommt im Klartext zurück. Kein stiller Erfolg (Wurzel 5).
 */
export async function checkOutReservation(
  reservationId: string,
  payment: CheckOutPayment,
): Promise<Result<CheckOutResult>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/check-out`, {
    method: "POST",
    body: payment,
  });
}

/**
 * Reservierung stornieren. Die Begründung ist Pflicht und wird auditiert.
 *
 * Die Storno-PARTEI wird NICHT mitgeschickt: der Server leitet sie aus der
 * Rolle ab (0410). Ein Betrieb darf seinen eigenen Storno nicht als
 * Gast-Storno ausgeben — daran hängt die Marktplatz-Provision (Wurzel 3).
 */
export async function cancelReservation(
  reservationId: string,
  reason: string,
  reasonCode?: CancelReasonCode,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: "POST",
    body: { reason, reason_code: reasonCode ?? null },
  });
}

/** Eine Gast-Anfrage annehmen → confirmed (sperrt die Nächte an den Portalen). */
export async function acceptReservationRequest(
  reservationId: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/accept`, {
    method: "POST",
  });
}

/** Eine Gast-Anfrage ablehnen → declined. Begründung optional (Gast sieht sie). */
export async function declineReservationRequest(
  reservationId: string,
  reason?: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/decline`, {
    method: "POST",
    body: { reason: reason ?? null },
  });
}
