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
  /** `"zahlung_offen"` = noch KEINE Buchung, nur eine Absicht (0409). */
  status: string;
  is_request: boolean;
  request_expires_at: string | null;
  /**
   * Seit Migration 0409 („keine Buchung ohne bezahlte Zahlung"): Bei einem
   * Sofortbuchungs-Objekt legt der Server NICHTS an, sondern eine
   * Buchungsabsicht plus Stripe-Zahlung. Erst der bestätigte Zahlungseingang
   * macht daraus eine Reservierung.
   *
   * Die App hat diese Felder bis 19.08.2026 nicht gelesen und deshalb
   * „Buchung bestätigt" angezeigt, obwohl der Server `zahlung_offen`
   * geantwortet hat — eine Bestätigung, die niemand gegeben hat.
   */
  zahlung_erforderlich?: boolean;
  client_secret?: string | null;
  publishable_key?: string | null;
  stripe_account?: string | null;
  total_amount?: number | null;
  currency?: string | null;
};

export type SearchParams = {
  q?: string;
  guests?: number;
  start?: string; // JJJJ-MM-TT
  end?: string;
  // Umkreissuche („In der Nähe"): nur gemeinsam sinnvoll, der Server lehnt
  // Halbangaben mit 422 ab. Ohne radius_km wird nur nach Entfernung sortiert.
  lat?: number;
  lng?: number;
  radius_km?: number;
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

/** Eine Zeile der Preisaufschlüsselung, wie sie der Gast sieht. */
export type QuoteLine = { label: string; amount: number; kind?: string | null };

export type Quote = {
  property_id: string;
  nights: number;
  currency: string;
  lines: QuoteLine[];
  total: number;
  priceless: boolean;
  pets_allowed: boolean;
  max_guests: number;
};

/** Verbindliche Preisaufschlüsselung vor der Buchung — dieselbe Rechnung wie
 *  beim Buchen. Nächte × Grundpreis selbst zu rechnen verschwiege Reinigung,
 *  Haustiergebühr und Abgaben. */
export async function getQuote(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  pets: number;
}): Promise<Result<Quote>> {
  return publicCall("/booking-engine/quote", { method: "POST", body: input });
}

/** Gastbuchung anlegen. Doppelbuchungs-Schutz + Kanal-Push laufen serverseitig;
 *  `total_amount` ist ein Anzeigewert — verbindlich rechnet der Server. */
export async function createBooking(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  /** Mitgebrachte Tiere; preiswirksam bei einer Gebühr „pro Tier / Aufenthalt". */
  pets?: number;
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

// Objektkategorien der Startseite. Das Datenmodell kennt genau zwei Arten
// buchbarer Einheiten: ein Ferienobjekt ODER ein einzelnes Zimmer (Hotel).
// Eine Kategorie erscheint als Reiter nur, wenn es dafür echte Objekte gibt.
const ZIMMER_TYPEN = new Set([
  "einzelzimmer",
  "doppelzimmer",
  "zweibettzimmer",
  "familienzimmer",
  "junior_suite",
  "suite",
]);

export type Kategorie = "alle" | "ferienobjekte" | "zimmer";

export function listingKategorie(listing: Listing): Exclude<Kategorie, "alle"> {
  return ZIMMER_TYPEN.has(listing.property_type) ? "zimmer" : "ferienobjekte";
}

export function filterKategorie(alle: Listing[], kategorie: Kategorie): Listing[] {
  if (kategorie === "alle") return alle;
  return alle.filter((l) => listingKategorie(l) === kategorie);
}

/** Städte mit tatsächlichem Angebot — Grundlage der Suchvorschläge. */
export function listingStaedte(alle: Listing[]): string[] {
  const zaehler = new Map<string, number>();
  for (const l of alle) {
    const stadt = l.city?.trim();
    if (!stadt) continue;
    zaehler.set(stadt, (zaehler.get(stadt) ?? 0) + 1);
  }
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]).map(([stadt]) => stadt);
}

/** „Stadt, Land" — leer, wenn beides fehlt (kein erfundener Ort). */
export function listingOrt(listing: { city: string | null; country: string | null }): string {
  return [listing.city, listing.country].filter(Boolean).join(", ");
}

// `suche` ist der Begriff, mit dem der Pfeil-Button der Sektion die
// Ergebnisliste öffnet — null bei der Reihe „alle", die keinen Filter hat.
export type ListingRow = { titel: string; listings: Listing[]; suche: string | null };

/**
 * Themen-Reihen aus ECHTEN Inseraten ableiten (wie plattform/lib/inserate.ts):
 * erst je Stadt, dann je Objekttyp. Leere Reihen entfallen — es wird keine
 * Kategorie erfunden, die keine Objekte hat. Die Titel folgen dem Muster der
 * Marktplatz-Apps („Beliebte Unterkünfte in X", „Übernachte in Y").
 */
export function listingRows(alle: Listing[]): ListingRow[] {
  if (alle.length === 0) return [];

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

  const reihen: ListingRow[] = [];
  // Städte zuerst und nach Angebotsdichte sortiert — die größte Auswahl oben.
  const staedte = [...nachStadt.entries()].sort((a, b) => b[1].length - a[1].length);
  staedte.forEach(([stadt, listings], i) => {
    reihen.push({
      titel: i === 0 ? `Beliebte Unterkünfte in ${stadt}` : `Übernachte in ${stadt}`,
      listings,
      suche: stadt,
    });
  });
  for (const [typ, listings] of nachTyp) {
    const label = listingTypeLabel(typ);
    reihen.push({ titel: `${label} für deine nächste Reise`, listings, suche: label });
  }
  // Auffangreihe, falls weder Stadt noch Typ gepflegt sind.
  if (reihen.length === 0) {
    reihen.push({ titel: "Beliebte Unterkünfte", listings: alle, suche: null });
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
