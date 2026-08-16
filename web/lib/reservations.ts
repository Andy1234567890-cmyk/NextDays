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
  // Eigene Website des Betriebs (0380) — provisionsfrei wie „direct", aber
  // getrennt auswertbar („was bringt meine Website?").
  | "website"
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
  // Eigentümer-Aufenthalt (0241): sperrt den Kalender wie jede Buchung, ist
  // aber kein Umsatz. Betrag/Anzahlung/Kanalgebühr erzwingt der Server auf 0 —
  // das Frontend schickt deshalb keinen Preis mit, sondern nur dieses Flag.
  is_owner_stay?: boolean;
  // Der verwaltete Eigentümer (owners, 0063), der den Aufenthalt nutzt (0353).
  // Er tritt an die Stelle des Gastes: mit gesetzter owner_id legt das Backend
  // KEINE Gast-Zeile an (`guest_id = null`) — ein Eigentümer gehört nicht in
  // die Gästekartei. Nur zusammen mit `is_owner_stay: true` erlaubt, sonst
  // weist der Server mit 422 ab (schemas.py `_owner_nur_bei_eigennutzung`).
  owner_id?: string;
  // WER wirklich da wohnt und WARUM (0354). Eine Eigennutzung ist nicht
  // zwangsläufig der Eigentümer selbst — derselbe Zeitraum geht an seine
  // Kinder, an Freunde oder an einen Handwerker. `owner_id` bleibt der
  // vertragliche Bezug, `stay_name` ist die anwesende Person. Nur zusammen
  // mit `is_owner_stay: true` erlaubt, sonst weist der Server mit 422 ab.
  stay_name?: string;
  stay_note?: string;
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
  // Eigentümer-Aufenthalt (0241): eigener Kalenderbalken, kein Umsatz.
  is_owner_stay: boolean;
  // Freitext zur Eigennutzung (0354) — steht auf dem Balken hinter dem Namen.
  // Die anwesende Person selbst kommt in `guest_name` (der Server setzt dort
  // `stay_name`, ersatzweise den Eigentümernamen).
  stay_note?: string | null;
  // Wann der Gast beim Portal gebucht hat (0291). null = nicht geliefert; die
  // Liste zeigt dann `created_at` und beschriftet es als Eingang bei uns —
  // unsere Uhr ist nie der Zeitpunkt einer fremden Handlung (Wurzel 5b).
  booked_at?: string | null;
  created_at?: string | null;
  // Ablage (0383): gesetzt = aus der Arbeitsliste genommen. Reine Ansichts-
  // Entscheidung — Belegung und Status bleiben unverändert.
  archived_at?: string | null;
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
  /** Vom Portal einbehaltene Steuern (collected_taxes, Booking.com) —
   *  mindern die Auszahlung zusätzlich zur Provision. */
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
  // Eigentümer-Aufenthalt (0241): die Detailansicht kennzeichnet ihn und lässt
  // Geld-/Rechnungsteile weg — es gibt dort keine zu zeigen.
  is_owner_stay: boolean;
  // Aktive Rechnung zur Buchung (Booking→Invoice-Brücke 0092), null = keine.
  invoice: ReservationInvoiceInfo | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_country: string | null;
  created_at: string | null;
  // Buchungszeitpunkt beim Portal (0291) — getrennt von `created_at`, siehe
  // Wurzel 5b. null = die Quelle hat ihn nicht geliefert.
  booked_at: string | null;
  // Ablage (0383) — gesetzt = archiviert.
  archived_at: string | null;
  // Konditionen des PORTALS (0384): für eine OTA-Buchung gilt die Staffel, die
  // Booking/Airbnb dem Gast zugesagt hat — nicht unsere eigene Kondition.
  // null = das Portal hat keine geliefert (NICHT „kostenfrei stornierbar").
  ota_cancel_penalties: { from: string; amount: string | number | null; currency: string | null }[] | null;
  ota_notes: string | null;
  ota_details: Record<string, unknown> | null;
  // Thread dieser Buchung im Posteingang (Channex-Booking-ID bzw.
  // `ue:<id>` beim übernommenen Bestand); null = keine Korrespondenz.
  message_thread_id: string | null;
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
// Eine gebuchte Zusatzleistung als Badge. Ohne Betrag — das Dashboard sagt,
// WAS vorzubereiten ist, nicht was es kostet.
export type DashboardAddon = {
  // Mehrsprachig (Locale → Text), aufgelöst über lib/lokalisiert.
  name: Record<string, string>;
  qty: number;
  paid: boolean;
};

export type DashboardEntry = {
  reservation_id: string;
  guest_name: string;
  property_title: string;
  channel: ReservationChannel;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  // Eigentümer-Aufenthalt (0241): in den Listen sichtbar, aber kein Umsatz.
  is_owner_stay: boolean;
  addons: DashboardAddon[];
  /** Buchungszeitpunkt aus der QUELLE (Wurzel 5b), nie unser Feed-Eingang. */
  booked_at: string | null;
  /** Thread im Posteingang; null = keine Korrespondenz → kein Knopf. */
  message_thread_id: string | null;
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
  // Was zuletzt hereinkam, sortiert nach Buchungszeitpunkt.
  neu_eingegangen: DashboardEntry[];
  // Wer heute im Haus ist (Abreisetag zählt nicht mit — der steht bei den
  // Check-outs und wäre sonst doppelt gezählt).
  im_haus: DashboardEntry[];
  // Angefragt, noch nicht entschieden, Aufenthalt noch nicht vorbei.
  freigabe_noetig: DashboardEntry[];
  // Die ECHTEN Anzahlen: die Listen darüber schneiden bei 50 ab, `length` wäre
  // dort das Limit und nicht die Anzahl.
  upcoming_gesamt: number;
  im_haus_gesamt: number;
  neu_gesamt: number;
  freigabe_gesamt: number;
  checkins_30d: DashboardKpi;
  // null, wenn der Nutzer keine Beträge sehen darf (Owner ohne PM_BOOKING_TOTAL,
  // Daten-Split §4.2) — die Umsatz-Kachel wird dann nicht gerendert.
  revenue_30d: DashboardKpi | null;
  // Umsatz je zahlender Buchung; dieselbe Sichtbarkeitsregel wie revenue_30d.
  revenue_per_booking_30d: DashboardKpi | null;
  confirmed_30d: DashboardKpi;
  currency: string;
  objekte_gesamt: number;
  objekte_inaktiv: number;
  objekte_entwurf: number;
};

/** Startseiten-Kennzahlen (echte Daten, im Backend berechnet). */
export async function getDashboard(): Promise<Result<Dashboard>> {
  return call("/reservations/dashboard");
}

/** Welche KPI-Kachel der Startseite nachgeladen wird (Backend-Enum). */
export type DashboardKpiMetrik =
  | "checkins"
  | "revenue"
  | "revenue_per_booking"
  | "confirmed";

/** Die wählbaren Auswertungszeiträume (Backend: core.zeitraum.ZEITRAEUME). */
export type Zeitraum = "7d" | "30d" | "3m" | "12m";

export type DashboardKpiAntwort = {
  metrik: DashboardKpiMetrik;
  zeitraum: string;
  tage: number;
  // null = diesen Wert gibt es für diesen Nutzer/diese Daten nicht (Beträge
  // maskiert, gemischte Währungen, keine zahlende Buchung im Fenster).
  kpi: DashboardKpi | null;
  currency: string;
};

/** Welche Listen-Karte der Startseite nachgeladen wird (Backend-Enum). */
export type DashboardListe =
  | "checkouts"
  | "checkins"
  | "freigabe"
  | "upcoming"
  | "im_haus";

/** Zeitfenster einer Listen-Karte, gerechnet ab heute (Backend-Enum). */
export type DashboardFenster = "heute" | "7d" | "30d" | "alle";

export type DashboardListeAntwort = {
  liste: DashboardListe;
  fenster: DashboardFenster;
  // Die ungedeckelte Anzahl — die Kachel zeigt sie; `items` schneidet bei 50 ab.
  gesamt: number;
  items: DashboardEntry[];
};

/** EINE Listen-Karte für ein gewähltes Zeitfenster nachladen. */
export async function getDashboardListe(
  liste: DashboardListe,
  fenster: DashboardFenster,
): Promise<Result<DashboardListeAntwort>> {
  return call(
    `/reservations/dashboard/liste?liste=${liste}&fenster=${fenster}`,
  );
}

/**
 * EINE Kachel für einen gewählten Zeitraum nachladen.
 *
 * Eigener Aufruf statt eines Neuladens der ganzen Startseite: die Kacheln sind
 * einzeln umschaltbar, und ein Umschalten soll nicht Listen, Zusatzleistungen
 * und Objektzahlen mitziehen.
 */
export async function getDashboardKpi(
  metrik: DashboardKpiMetrik,
  zeitraum: Zeitraum,
): Promise<Result<DashboardKpiAntwort>> {
  return call(
    `/reservations/dashboard/kpi?metrik=${metrik}&zeitraum=${zeitraum}`,
  );
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

// --- Buchungskonditionen + Zahlungsstand ------------------------------------

/** Eine Stufe der Storno-Staffel (X % zurück ab Y Tagen vor Anreise). */
export type ReservationRefundRule = {
  refund_percent: number;
  days_before_arrival: number;
};

/** Kaution der geltenden Kondition — Betrag bereits ausgerechnet. */
export type ReservationDeposit = {
  amount: number;
  method: string | null;
  currency: string | null;
  preauth_days_before_arrival: number | null;
  release_days_after_departure: number | null;
};

/** Eine Zahlungszeile der Buchung: geplant (due_at) oder vollzogen. */
export type ReservationTransaction = {
  id: string;
  at: string;
  amount: number | null;
  currency: string;
  status: string;
  type: string;
  due_at: string | null;
};

/** Konditionen + Zahlungsstand. Leere Plan-Felder heißen „alles sofort
 *  fällig" (keine Kondition gepflegt) — kein erfundener Plan. */
export type ReservationConditions = {
  condition_name: string | null;
  installments: number;
  due_now: number | null;
  due_later: number | null;
  balance_due_date: string | null;
  cancellation_mode: string | null;
  refund_rules: ReservationRefundRule[];
  deposit: ReservationDeposit | null;
  transactions: ReservationTransaction[];
  currency: string;
};

/** Buchungskonditionen + Zahlungszeilen einer Buchung. */
export async function getReservationConditions(
  reservationId: string,
): Promise<Result<ReservationConditions>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/conditions`);
}

/** Interne Notiz setzen (leerer Text entfernt sie). */
export async function updateReservationNote(
  reservationId: string,
  note: string,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/note`, {
    method: "PATCH",
    body: { note },
  });
}

/** Buchung in die Ablage legen (`true`) oder zurückholen (`false`). Ohne
 *  Nebenwirkung auf Status/Belegung — Nächte gibt nur der Storno frei. */
export async function setReservationArchived(
  reservationId: string,
  archived: boolean,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/archive`, {
    method: "PATCH",
    body: { archived },
  });
}

export type ReservationGuestPatch = {
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  guest_language?: string | null;
  guest_country?: string | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
};

/** Gastdaten + erwartete Zeiten DIESER Buchung korrigieren (die Gästekartei
 *  bleibt unberührt — eine Buchung schreibt keine Stammdaten um). */
export async function updateReservationGuest(
  reservationId: string,
  patch: ReservationGuestPatch,
): Promise<Result<Reservation>> {
  return call(`/reservations/${encodeURIComponent(reservationId)}/guest`, {
    method: "PATCH",
    body: patch,
  });
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
