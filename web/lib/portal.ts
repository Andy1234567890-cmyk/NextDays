"use server";

// Eigentümer-Portal (§4.2) — Server-Actions gegen den FastAPI-public_portal-Slice
// (/api/v1/public-portal). Typen exakt am Pydantic-Contract
// (apps/api/src/features/public_portal/schemas.py); Schwesterdatei der
// React-Native-Fassung mobile-nextdays/lib/ownerPortal.ts.
//
// Der eingeloggte Eigentümer sieht NUR seine zugeordneten Objekte; Beträge sind
// serverseitig über guest_masking maskiert. `null` heißt „keine Beträge-Sicht"
// und wird als „—" gerendert — NIE als 0 und nie mit einem Ersatzwert
// aufgefüllt (Wurzel 4).
//
// Business-Logik bleibt im Backend (PROJECT.md §2): hier wird nur aufgerufen.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return { ok: true, data: await api<T>(path, { ...opts, token }) };
  } catch (exc) {
    // Ein Ladefehler darf nicht als „nichts vorhanden" erscheinen: „leer" und
    // „konnte nicht laden" sind zwei verschiedene Aussagen (Wurzel 4/5).
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Backend nicht erreichbar.",
    };
  }
}

// --- Objekte ---------------------------------------------------------------

export type PortalProperty = {
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
};

export async function getOwnerProperties(): Promise<
  Result<{ items: PortalProperty[]; total: number }>
> {
  return call("/public-portal/properties");
}

// --- Belegungskalender (read-only, maskiert) --------------------------------

/**
 * EINE Buchung, die eine Nacht belegt — eine Zeile je EINHEIT (0265).
 * Spiegelt apps/api/.../public_portal/schemas.py:PortalNightBooking.
 *
 * Seit 0265 führt ein Objekt (= ein Einheiten-TYP) n ≥ 1 Einheiten; dieselbe
 * Nacht kann daher mehrere Buchungen tragen. Die verdichteten Felder auf
 * `PortalCalendarDay` (guest_first_name, booking_source) beschreiben nur die
 * ERSTE davon — wer sie neben der SUMME `owner_payout_per_night` rendert,
 * ordnet den Gesamtbetrag einem einzelnen Gast zu. Deshalb rendert die UI
 * je Buchung einen eigenen Chip aus dieser Liste.
 */
export type PortalNightBooking = {
  /** Klammert die Nächte EINES Aufenthalts zusammen (Chip über den Aufenthalt
   *  statt je Nacht) und ist der Schlüssel für die Aufenthaltssumme. */
  reservation_id: string;
  /** Belegte Einheit; `null` = Buchung liegt auf dem Typ als Ganzes
   *  (Altbestand vor 0265 oder Objekt mit genau einer Einheit). */
  unit_id: string | null;
  /** Netto-Auszahlung des Eigentümers für DIESE Buchung in DIESER Nacht.
   *  `null` = nicht ausweisbar → „—", nie eine 0 (Wurzel 4). */
  owner_payout_per_night: number | null;
  /** Währung DIESES Betrags, aus den Daten. Kein €-Fallback. */
  currency: string | null;
  /** provision | betrag | naechte — warum kein Betrag ausgewiesen wird. */
  payout_unknown_reason: string | null;
  /** NUR der Vorname (zentrale GuestMask, §4.2). */
  guest_first_name: string | null;
  /** Buchungsquelle (ota_name, sonst channel) — für Logo und Kanalfarbe. */
  booking_source: string | null;
};

export type PortalCalendarDay = {
  date: string; // YYYY-MM-DD
  status: string; // open | booked | blocked
  /**
   * GAST-Verkaufspreis der Nacht. Für einen Eigentümer laut §4.2 IMMER `null`
   * (die Maske gibt ihm keine Gast-Beträge). Dieses Feld wird im Portal
   * bewusst NICHT gerendert — es steht hier nur, weil der Contract es führt.
   */
  price: number | null;
  /**
   * Der EINZIGE Betrag, den der Eigentümer sehen darf: seine Netto-Auszahlung
   * für DIESE Nacht (Buchungs-Payout abzüglich Provision, über die Nächte des
   * Aufenthalts verteilt). `null` = kein Betrag ausweisbar → „—" rendern, nie
   * eine 0 erfinden (Wurzel 4); den Grund nennt `owner_payout_unknown_reason`.
   */
  owner_payout_per_night: number | null;
  /** Währung DIESES Betrags, aus den Daten. Fehlt sie, rendert formatCurrency
   *  symbollos — es wird kein „EUR" ergänzt (Wurzel 4). */
  currency: string | null;
  /** provision | betrag | naechte — warum kein Betrag ausgewiesen wird. */
  owner_payout_unknown_reason: string | null;
  /** NUR der Vorname (zentrale GuestMask). Der volle Name erscheint im
   *  Eigentümer-Pfad nie (§4.2). Bei mehreren belegten Einheiten der ERSTE —
   *  die vollständige Aufstellung steht in `bookings`. */
  guest_first_name: string | null;
  /** Buchungsquelle der Nacht (ota_name, sonst channel) — für das echte
   *  Portal-Logo aus lib/channel-logos.ts. Ebenfalls nur die ERSTE Buchung. */
  booking_source: string | null;
  /** Alle Buchungen dieser Nacht, eine je belegter EINHEIT. Leer = keine
   *  Buchung. Die drei Felder oben sind nur ihre Verdichtung. */
  bookings: PortalNightBooking[];
  /** Wie viele Einheiten des Typs an diesem Tag belegt sind. */
  units_booked: number;
  /** Wie viele Einheiten der Typ überhaupt führt (property_units). Ohne diese
   *  Zahl ist `units_booked` nicht einzuordnen. */
  units_total: number;
};

export type PortalCalendar = {
  property_id: string;
  days: PortalCalendarDay[];
};

export async function getOwnerCalendar(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<PortalCalendar>> {
  const p = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/public-portal/calendar?${p.toString()}`);
}

// --- Einnahmen (maskiert) ---------------------------------------------------

export type PortalEarningsItem = {
  property_id: string;
  title: string;
  nights: number;
  reservations: number;
  /** `null` ohne Beträge-Sicht (kein Fallback). */
  payout: number | null;
  currency: string;
};

export type PortalEarnings = {
  period_from: string;
  period_to: string;
  items: PortalEarningsItem[];
  total_payout: number | null;
  currency: string;
};

export async function getOwnerEarnings(
  periodFrom: string,
  periodTo: string,
): Promise<Result<PortalEarnings>> {
  const p = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
  });
  return call(`/public-portal/earnings?${p.toString()}`);
}

// --- Abrechnungen (eigene, finalisierte) ------------------------------------

export type PortalStatement = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  owner_payout: number;
  currency: string;
  invoice_number: string | null;
  created_at: string | null;
};

export async function getOwnerStatements(): Promise<
  Result<{ items: PortalStatement[]; total: number }>
> {
  return call("/public-portal/statements");
}

// --- Sperr-Anträge ----------------------------------------------------------
// Der Eigentümer kann NICHT selbst sperren, nur BEANTRAGEN (§4.2). Es gibt im
// Portal bewusst keinen Weg auf /calendar/block — die Agentur entscheidet.

export type BlockRequest = {
  id: string;
  property_id: string;
  /** INKLUSIV („vom 1. bis zum 5."). */
  start_date: string;
  /** INKLUSIV — die Umrechnung auf den exklusiven Kalender-Range macht erst
   *  die Genehmigung im Backend. */
  end_date: string;
  status: string;
  /** Warum gesperrt werden soll (Eigennutzung, Handwerker …). */
  reason: string | null;
  /** Wann entschieden wurde — nicht, WER entschieden hat (§4.3). */
  decided_at: string | null;
  /** Anmerkung der Verwaltung zur Entscheidung. */
  decision_note: string | null;
  created_at: string | null;
};

export async function getBlockRequests(): Promise<
  Result<{ items: BlockRequest[]; total: number }>
> {
  return call("/public-portal/block-requests");
}

export async function createBlockRequest(input: {
  property_id: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
}): Promise<Result<BlockRequest>> {
  return call("/public-portal/block-requests", { method: "POST", body: input });
}

// --- Zählerstände (append-only) ---------------------------------------------
// Es gibt bewusst KEIN PATCH/DELETE im Contract: ein abgelesener Zählerstand
// ist eine Messung, keine Meinung. Korrekturen laufen über einen NEUEN Eintrag,
// die Historie bleibt vollständig.

export type MeterReading = {
  id: string;
  property_id: string;
  meter_kind: string;
  value: number;
  read_at: string;
  created_at: string | null;
};

export async function getMeterReadings(
  propertyId: string,
): Promise<Result<{ items: MeterReading[]; total: number }>> {
  const p = new URLSearchParams({ property_id: propertyId });
  return call(`/public-portal/meter-readings?${p.toString()}`);
}

export async function createMeterReading(input: {
  property_id: string;
  meter_kind: string;
  value: number;
  read_at: string;
}): Promise<Result<MeterReading>> {
  return call("/public-portal/meter-readings", { method: "POST", body: input });
}

// --- Dienstleistungen buchen ------------------------------------------------
// Der Katalog kommt VOM SERVER (/public-portal/service-types) — die UI führt
// keine eigene Leistungsliste. Der Anzeigename entsteht aus dem stabilen `key`
// über `portal.services.type.<key>`; ein deutsches Wort aus der DB wäre in 23
// von 24 Sprachen falsch (Wurzel 4).
//
// Ein Auftrag ist ENTWEDER ein Katalogtyp (`service_type_id`) ODER ein Freitext
// — nie beides und nie keines; das Backend antwortet sonst mit 422. Der POST
// ist serverseitig idempotent (derselbe Auftrag am selben Tag liefert den
// bestehenden zurück, Wurzel 2).

export type ServiceType = {
  id: string;
  /** Stabiler Katalog-Schlüssel (endreinigung, hauptreinigung, …). */
  key: string;
  kategorie: string; // cleaning | maintenance | inspection
  standard_dauer_minuten: number | null;
  /** true = Systemvorgabe, false = eigener Typ des Betriebs. */
  system: boolean;
};

export async function getServiceTypes(): Promise<
  Result<{ items: ServiceType[]; total: number }>
> {
  return call("/public-portal/service-types");
}

export type ServiceRequest = {
  id: string;
  property_id: string | null;
  service_type_id: string | null;
  /** Katalog-Schlüssel für die Übersetzung; null bei Freitext-Aufträgen. */
  service_key: string | null;
  titel: string;
  notiz: string | null;
  status: string;
  /** Sagt NUR, OB jemand dran ist — wer, geht den Eigentümer nichts an (§4.3). */
  zugewiesen: boolean;
  start_at: string | null;
  created_at: string | null;
};

export async function getServiceRequests(): Promise<
  Result<{ items: ServiceRequest[]; total: number }>
> {
  return call("/public-portal/service-requests");
}

export async function createServiceRequest(input: {
  property_id: string;
  service_type_id?: string | null;
  freitext?: string | null;
  datum: string;
  datum_bis?: string | null;
  notiz?: string | null;
}): Promise<Result<ServiceRequest>> {
  return call("/public-portal/service-requests", {
    method: "POST",
    body: input,
  });
}
