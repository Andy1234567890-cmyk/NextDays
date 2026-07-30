// Öffentliche Buchungsstrecke (booking_engine-Slice, /api/v1/booking-engine).
// Kein Token: die Marktplatz-Liste, das Detail und die Verfügbarkeit sind
// öffentlich; die Buchung selbst legt der Server an (tenant_id kommt aus der
// Property, nicht vom Client). Contract: booking_engine/schemas.py.
//
// Wurzel 4: `price_from`/`price` bleiben null, wenn kein Preis hinterlegt ist —
// die UI zeigt dann „Preis auf Anfrage", NIE 0 oder einen erfundenen Wert. Die
// Währung kommt immer aus dem Objekt (`currency`), nie hartkodiert.
import { publicCall, type Result } from "@/lib/guestApi";

export type Listing = {
  id: string;
  title: string;
  property_type: string;
  city: string | null;
  country: string | null;
  photos: string[];
  max_guests: number;
  bedrooms: number | null;
  baths: number | null;
  amenities: string[];
  price_from: number | null;
  currency: string;
  rating: number | null;
  rating_count: number | null;
};

export type ListingAddon = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  media: string[];
  price: number;
  basis: string;
  mandatory: boolean;
  tax_rate: number | null;
};

export type ListingDetail = Listing & {
  description: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  nights: number | null;
  addons: ListingAddon[];
  search_engine_indexing: boolean;
};

export type AvailabilityDay = { date: string; available: boolean };

export type BookingCreated = {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  status: string;
  is_request: boolean;
  request_expires_at: string | null;
};

export type SearchParams = {
  q?: string;
  guests?: number;
  start?: string; // JJJJ-MM-TT
  end?: string;
};

function query(params: Record<string, string | number | undefined>): string {
  const teile: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    teile.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return teile.length ? `?${teile.join("&")}` : "";
}

/** Aktive, buchbare Objekte des Marktplatzes (optional gefiltert). */
export async function searchListings(
  params: SearchParams = {},
): Promise<Result<{ items: Listing[]; total: number }>> {
  return publicCall(`/booking-engine/listings${query({ ...params })}`);
}

/** Detail eines aktiven Objekts. Mit start/end enthält `price` den
 *  Effektivpreis des Zeitraums, sonst entspricht er `price_from`. */
export async function getListing(
  id: string,
  params: { start?: string; end?: string } = {},
): Promise<Result<ListingDetail>> {
  return publicCall(`/booking-engine/listings/${encodeURIComponent(id)}${query(params)}`);
}

/** Tagesgenaue Verfügbarkeit (available=false → belegt/gesperrt). */
export async function getAvailability(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ property_id: string; days: AvailabilityDay[] }>> {
  return publicCall(
    `/booking-engine/availability${query({ property_id: propertyId, start, end })}`,
  );
}

/** Gastbuchung anlegen. Doppelbuchungs-Schutz + Kanal-Push laufen serverseitig;
 *  `total_amount` ist ein Anzeigewert — verbindlich rechnet der Server. */
export async function createBooking(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  contact: { first_name: string; last_name: string; email: string; phone?: string };
  total_amount?: number;
  addons?: { addon_id: string; qty: number }[];
}): Promise<Result<BookingCreated>> {
  return publicCall("/booking-engine/reservations", { method: "POST", body: input });
}

// Deutsche Labels der property_type-Enum (Spiegel von apps/web/lib/property-meta.ts).
const TYP_LABEL: Record<string, string> = {
  ferienhaus: "Ferienhaus",
  appartement: "Appartement",
  glamping: "Glamping",
  tiny_house: "Tiny House",
  stellplatz: "Stellplatz",
  hausboot: "Hausboot",
  einzelzimmer: "Einzelzimmer",
  doppelzimmer: "Doppelzimmer",
  zweibettzimmer: "Zweibettzimmer",
  familienzimmer: "Familienzimmer",
  junior_suite: "Junior Suite",
  suite: "Suite",
};

export function listingTypeLabel(type: string): string {
  return TYP_LABEL[type] ?? type;
}

/** „Stadt, Land" — leer, wenn beides fehlt (kein erfundener Ort). */
export function listingOrt(listing: { city: string | null; country: string | null }): string {
  return [listing.city, listing.country].filter(Boolean).join(", ");
}

export type ListingRow = { titel: string; listings: Listing[] };

/**
 * Themen-Reihen aus ECHTEN Inseraten ableiten (wie plattform/lib/inserate.ts):
 * erst „alle", dann je Objekttyp, dann je Stadt. Leere Reihen entfallen —
 * es wird keine Kategorie erfunden, die keine Objekte hat.
 */
export function listingRows(alle: Listing[]): ListingRow[] {
  if (alle.length === 0) return [];
  const reihen: ListingRow[] = [{ titel: "Beliebte Unterkünfte", listings: alle }];

  const nachTyp = new Map<string, Listing[]>();
  const nachStadt = new Map<string, Listing[]>();
  for (const l of alle) {
    if (l.property_type) {
      const arr = nachTyp.get(l.property_type) ?? [];
      arr.push(l);
      nachTyp.set(l.property_type, arr);
    }
    const stadt = l.city?.trim();
    if (stadt) {
      const arr = nachStadt.get(stadt) ?? [];
      arr.push(l);
      nachStadt.set(stadt, arr);
    }
  }
  for (const [typ, listings] of nachTyp) {
    reihen.push({ titel: listingTypeLabel(typ), listings });
  }
  for (const [stadt, listings] of nachStadt) {
    reihen.push({ titel: `Unterkünfte in ${stadt}`, listings });
  }
  return reihen;
}

/** Nächte zwischen zwei ISO-Tagen (check_out exklusiv). 0, wenn ungültig. */
export function naechte(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}
