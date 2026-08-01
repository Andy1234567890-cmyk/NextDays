"use server";

// Reservierungen: Server-Actions gegen den FastAPI-reservations-Slice
// (/api/v1/reservations). Anlegen prüft im Backend Double-Booking und belegt
// die Kalendertage. Business-Logik bleibt im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import type {
  StatMetric,
  StatMetricDetail,
  StatMetricDetailResponse,
  StatSeries,
} from "@/lib/stats-meta";

// Spiegelt apps/api/.../reservations/schemas.py:ReservationChannel.
// „ota_other" = Sammelkanal für OTAs ohne eigenen Wert (Expedia, Agoda …).
export type ReservationChannel =
  | "direct"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  | "ota_other";
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
  paid_amount: number | null; // bereits bezahlt (für Bezahlt-Anteil in der Liste); null wie total_amount
  currency: string;
  ota_name: string | null; // echter Portal-Name (Booking.com, Airbnb, Expedia …)
  external_ref: string | null; // OTA-Reservierungscode
  num_guests: number; // Gästezahl (Balken-Anzeige)
  adults: number; // Aufschlüsselung (Buchungsliste: Gäste-/Kinder-Icons)
  children: number; // Kinderzahl (Kinder-Icon nur wenn > 0)
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
  // Objekt-Standort (aus properties): strukturierte Adresse + optionale
  // Koordinaten für die Standortkarte. lat/lng null → keine Karte, nur Text.
  property_street: string | null;
  property_postal_code: string | null;
  property_city: string | null;
  property_country: string | null;
  property_lat: number | null;
  property_lng: number | null;
  guest_id: string | null;
  guest_name: string;
  channel: ReservationChannel;
  ota_name: string | null;
  external_ref: string | null;
  external_url: string | null;
  /** Wer zieht ein: 'property' = wir, 'ota' = Portal hat kassiert, null = das
   *  Portal hat dazu nichts geliefert (NICHT „wir"). */
  payment_collect: "property" | "ota" | null;
  payment_method_ota: "credit_card" | "bank_transfer" | null;
  /** Vom Portal einbehaltene Provision in Buchungswährung. */
  ota_commission: number | null;
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
  // Preisverhalten (protel-Modell): undefined/false = Preis behalten (kostenloses
  // Upgrade / bindender Preis); true = Preis fürs Ziel-Objekt neu berechnen (Upsell).
  reprice?: boolean,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/move`, {
    method: "PATCH",
    body: {
      property_id: propertyId,
      check_in: checkIn,
      check_out: checkOut,
      ...(reprice ? { reprice: true } : {}),
    },
  });
}

/** Vollständige Detailansicht einer Reservierung (rechter Slider). */
export async function getReservationDetail(
  reservationId: string,
): Promise<Result<ReservationDetail>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}`);
}

// --- Zeitleiste (Ereignis-Log einer Buchung) --------------------------------

// Stabiler Ereignis-Schlüssel; die Beschriftung/Übersetzung macht das UI.
// Deckt den KOMPLETTEN Buchungs-Flow ab (Lifecycle + Nachrichten/Zahlungen/
// Aufgaben/Add-ons) — [[buchungs-zeitleiste-kompletter-flow]].
export type TimelineEventKind =
  | "created"
  | "moved"
  | "repriced"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "task_created"
  | "message"
  | "payment"
  | "addon";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind | string;
  at: string; // ISO-Zeitstempel
  by_user_id: string | null;
  // Frei strukturierte Detaildaten (Alt/Neu-Objekt, Grund, Titel, Betrag …).
  // Beträge sind serverseitig bereits maskiert (null ohne Freigabe).
  detail: Record<string, unknown>;
  synthetic: boolean;
};

export type Timeline = {
  // Objekt-Kontext aller Ereignisse (Thumbnail + Name je Karte).
  // property_id für den klickbaren Objekt-Badge.
  property_id: string;
  property_title: string;
  property_photo: string | null;
  items: TimelineEvent[];
};

/** Ereignis-Zeitleiste einer Buchung (neueste zuerst). Kombiniert echte
 *  reservation_events mit synthetischen Basis-Events (Altbuchungen). */
export async function getReservationTimeline(
  reservationId: string,
): Promise<Result<Timeline>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/timeline`);
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

// --- Objekt-Statistiken (Statistiken-Reiter) -------------------------------
export type StatKpi = { value: number; change_pct: number | null };

export type ChannelBreakdown = {
  channel: string;
  ota_name: string | null;
  amount: number | null; // null ohne Betrags-Sichtbarkeit
  nights: number;
};

// Statistik-Detail-Typen + Metrik-Liste liegen in stats-meta.ts (diese Datei ist
// "use server" und darf keine Laufzeit-Konstanten exportieren). Typen werden
// re-exportiert, damit bestehende Importe aus "@/lib/reservations" weiter gehen.
export type {
  StatComparePeriod,
  StatMetric,
  StatMetricDetail,
  StatMetricDetailResponse,
  StatPoint,
  StatSeries,
} from "@/lib/stats-meta";

export type PropertyStats = {
  property_id: string;
  property_title: string;
  currency: string;
  date_from: string;
  date_to: string;
  // Betrags-KPIs: null ohne Betrags-Sichtbarkeit / bei gemischten Währungen.
  revenue: StatKpi | null;
  payments_received: StatKpi | null;
  avg_booking_value: StatKpi | null;
  avg_price_per_night: StatKpi | null;
  // Zähl-KPIs (immer sichtbar)
  hosted_guests: StatKpi;
  booked_nights: StatKpi;
  occupancy_rate: StatKpi;
  days_booked_ahead: StatKpi;
  avg_stay_length: StatKpi;
  created_reservations: StatKpi;
  cancelled_reservations: StatKpi;
  cancelled_nights: StatKpi;
  by_channel: ChannelBreakdown[];
  // Tages-Zeitreihen je KPI (Kachel-Sparkline). metric = KPI-Kennung.
  series: StatSeries[];
};

/** Objekt-Kennzahlen im Zeitraum (Default Backend: letzte 30 Tage). */
export async function getPropertyStats(
  propertyId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<Result<PropertyStats>> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return call(
    `/reservations/property/${encodeURIComponent(propertyId)}/stats${qs ? `?${qs}` : ""}`,
  );
}

/** KPI-Detailseite (Klick auf eine Statistik-Kachel): Tagesreihe +
 * Vergleichsperioden + Breakout für EINE Kennzahl. */
export async function getMetricDetail(
  propertyId: string,
  metric: StatMetric,
  dateFrom?: string,
  dateTo?: string,
): Promise<Result<StatMetricDetailResponse>> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return call(
    `/reservations/property/${encodeURIComponent(propertyId)}/stats/${metric}${
      qs ? `?${qs}` : ""
    }`,
  );
}

// Statistik-Query-String bauen — Zeitraum + optionaler (wiederholbarer)
// property_id-Filter fürs globale Kontrollzentrum („Ausgewählte Unterkünfte").
function statsQuery(
  dateFrom?: string,
  dateTo?: string,
  propertyIds?: string[],
): string {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  for (const id of propertyIds ?? []) params.append("property_id", id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Globales Kontrollzentrum: zusammengefasste Kennzahlen über ALLE (owner-
 * sichtbaren) Objekte. `propertyIds` filtert auf ausgewählte Unterkünfte. */
export async function getTenantStats(
  dateFrom?: string,
  dateTo?: string,
  propertyIds?: string[],
): Promise<Result<PropertyStats>> {
  return call(`/reservations/stats${statsQuery(dateFrom, dateTo, propertyIds)}`);
}

/** KPI-Detailseite tenant-weit (Kontrollzentrum „ANSEHEN"). */
export async function getTenantMetricDetail(
  metric: StatMetric,
  dateFrom?: string,
  dateTo?: string,
  propertyIds?: string[],
): Promise<Result<StatMetricDetail>> {
  return call(
    `/reservations/stats/${metric}${statsQuery(dateFrom, dateTo, propertyIds)}`,
  );
}
