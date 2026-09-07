// Preis-Wahrheit eines Objekts lesen (Server-Reads). Der Airbnb-Pricing-Editor
// darf NICHT den type_attributes.pricing-Blob als Quelle nehmen — der wird vom
// Resolver/Kalender/Quote/Channex ignoriert. Die echten Quellen sind:
//   • Grundpreis  → rate_plans.base_price   (GET /rates)
//   • Smart Pricing → dp_settings           (GET /pricing/settings/{id})
//   • Rabatte     → property_discounts       (GET /pricing/discounts/{id})
// Diese Lib bündelt das Lesen in EINE Struktur, die das Panel rendert.
import { api } from "./api-server";

// --- Rate-Plans (Grundpreis) ---------------------------------------------
interface RatePlan {
  id: string;
  property_id: string;
  name: string;
  base_price: number;
  currency: string;
  min_stay: number;
  derived_from_rate_plan_id?: string | null;
  /** Buchungsbedingung des Plans (0165); null = Betriebs-Standard gilt. */
  booking_condition_id?: string | null;
  /** Bedingung für lange Aufenthalte (0579). */
  booking_condition_long_id?: string | null;
}
interface RatePlanList {
  items: RatePlan[];
}

// --- Dynamic Pricing / Smart Pricing (dp_settings) -----------------------
export interface DpSettings {
  property_id: string;
  enabled: boolean;
  min_price: number | null;
  max_price: number | null;
  weekend_uplift_pct: number;
}

// --- Rabatte (property_discounts) ----------------------------------------
export interface Discount {
  id: string;
  property_id: string;
  discount_type: "length_of_stay" | "early_booker" | "last_minute" | "custom";
  discount_bps: number;
  active: boolean;
  min_nights: number | null;
  days_before: number | null;
}

// Aggregierter Preis-Stand fürs Panel — aus den echten Quellen, kein Blob.
export interface PreisStand {
  // Grundpreis-Plan des Objekts (FeWo: der eine Plan). null = noch keiner.
  basePrice: number | null;
  currency: string | null;
  // Der Rate-Plan, an den base_price/currency hängen (für spätere Patches).
  ratePlanId: string | null;
  /** Buchungsbedingung dieses Plans (0165); null = es gilt der Betriebs-Standard. */
  bookingConditionId: string | null;
  /** Bedingung für LANGE Aufenthalte (0579); null = die obige gilt auch dort. */
  bookingConditionLongId: string | null;
  // Objektweiter Mindestaufenthalt (rate_plans.min_stay) — für das Verfügbarkeits-Tab.
  minStay: number;
  smart: DpSettings;
  // Länge-Rabatte (Airbnb Wochen-/Monatsrabatt), nach min_nights indexiert.
  weeklyDiscount: Discount | null; // min_nights === 7
  monthlyDiscount: Discount | null; // min_nights === 28
}

// Empfohlene Smart-Pricing-Spanne aus der Dynamic-Pricing-Engine.
export interface SmartVorschlag {
  available: boolean;
  min_price: number | null;
  max_price: number | null;
}

// --- Marktvergleich (Airbnb „Compare similar listings") -------------------
interface PublicListing {
  id: string;
  city: string | null;
  max_guests: number;
  bedrooms: number | null;
  property_type: string;
  price_from: number | null;
  currency: string;
}
interface PublicListingList {
  items: PublicListing[];
}
interface PublicListingDetail {
  id: string;
  lat: number | null;
  lng: number | null;
  price_from: number | null;
  currency: string;
}

// Ein Kartenpunkt der Vergleichskarte (echte, grob gerundete Koordinaten).
export interface VergleichPunkt {
  id: string;
  lat: number;
  lng: number;
  preis: number;
  eigenes: boolean;
}

export interface MarktVergleich {
  anzahl: number;
  min: number | null;
  max: number | null;
  currency: string | null;
  // Kurzbeschreibung des eigenen Objekts (Airbnb „Private room · 0-2 bedrooms").
  eigenesTyp: string | null;
  // Kartenpunkte (eigenes Objekt + Vergleichsobjekte mit Koordinaten).
  punkte: VergleichPunkt[];
}

// Harte Obergrenzen (Wurzel 8: unbegrenzte Liste/Fetches begrenzen).
const MAX_KANDIDATEN = 40; // Detail-Fetches je Vergleich
const UMKREIS_KM = 50; // Vergleichs-Radius (Airbnb-artig: Objekte in der Nähe)

// Haversine-Distanz in km zwischen zwei Koordinaten.
function distanzKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

/** Echter Marktvergleich aus den Marktplatz-Inseraten (booking-engine/listings):
 *  Objekte im UMKREIS (Koordinaten-Nähe, nicht Ortsname), ±2 Gäste, mit Preis.
 *  Liefert Preisspanne UND Kartenpunkte. KEINE erfundenen Zahlen (Wurzel 4).
 *  Ohne eigenen Standort (lat/lng) gibt es keinen Umkreis → leer. */
export async function getMarktVergleich(
  propertyId: string,
  eigeneKoords: { lat: number; lng: number } | null,
  guests: number,
): Promise<MarktVergleich> {
  const leer: MarktVergleich = {
    anzahl: 0, min: null, max: null, currency: null, eigenesTyp: null, punkte: [],
  };
  if (!eigeneKoords) return leer;

  const res = await api<PublicListingList>(`/booking-engine/listings?guests=${guests}`).catch(
    () => null,
  );
  if (!res) return leer;

  // Kandidaten: andere Objekte mit Preis, ±2 Gäste. Koordinaten holt der
  // Detail-Endpoint (Liste hat keine) → danach nach Umkreis filtern.
  const kandidaten = res.items
    .filter((l) => l.id !== propertyId)
    .filter((l) => Math.abs(l.max_guests - guests) <= 2)
    .filter((l) => l.price_from != null)
    .slice(0, MAX_KANDIDATEN);

  const eigenes = res.items.find((l) => l.id === propertyId) ?? null;

  // Detail-Koordinaten aller Kandidaten (parallel, Fehler je Objekt → entfällt).
  const details = await Promise.all(
    kandidaten.map((l) =>
      api<PublicListingDetail>(`/booking-engine/listings/${l.id}`)
        .then((d) => ({ listing: l, detail: d }))
        .catch(() => null),
    ),
  );

  // Nur Objekte im Umkreis mit gültigen Koordinaten + Preis.
  const imUmkreis = details
    .filter((x): x is { listing: PublicListing; detail: PublicListingDetail } => x != null)
    .filter((x) => x.detail.lat != null && x.detail.lng != null)
    .map((x) => ({
      id: x.listing.id,
      lat: x.detail.lat as number,
      lng: x.detail.lng as number,
      preis: (x.detail.price_from ?? x.listing.price_from) as number,
      currency: x.listing.currency,
    }))
    .filter((x) => x.preis != null)
    .filter((x) => distanzKm(eigeneKoords, x) <= UMKREIS_KM);

  const preise = imUmkreis.map((x) => x.preis);
  // Das eigene Objekt ist IMMER ein Kartenpunkt (roter Pin) — die Karte zeigt
  // mindestens den eigenen Standort, auch wenn keine Nachbarn im Umkreis liegen.
  const punkte: VergleichPunkt[] = [
    { id: propertyId, lat: eigeneKoords.lat, lng: eigeneKoords.lng, preis: 0, eigenes: true },
    ...imUmkreis.map((x) => ({
      id: x.id,
      lat: x.lat,
      lng: x.lng,
      preis: x.preis,
      eigenes: false,
    })),
  ];

  return {
    anzahl: imUmkreis.length,
    min: preise.length ? Math.min(...preise) : null,
    max: preise.length ? Math.max(...preise) : null,
    currency: imUmkreis[0]?.currency ?? null,
    eigenesTyp: eigenes ? eigenesTypLabel(eigenes) : null,
    punkte,
  };
}

// Kurzbeschreibung wie Airbnb („… · 2 Schlafzimmer"). Nur echte Felder.
function eigenesTypLabel(l: PublicListing): string {
  const teile: string[] = [l.property_type];
  if (l.bedrooms != null) teile.push(`${l.bedrooms} Schlafzimmer`);
  return teile.join(" · ");
}

/** Kompletten Preis-Stand eines Objekts aus den echten Tabellen laden. */
export async function getPreisStand(propertyId: string): Promise<PreisStand> {
  // Grundpreis-Read schlägt bei echten Fehlern (403/500) BEWUSST durch — ein
  // Fehler darf nicht als „kein Preis" verschleiert werden (Wurzel 5). Eine leere
  // items-Liste (noch kein Rate-Plan) ist KEIN Fehler und normal für Entwürfe.
  // dp_settings/discounts dürfen fehlen → leere Defaults (legitim, kein Fake).
  const [rates, smart, discounts] = await Promise.all([
    api<RatePlanList>(`/rates?property_id=${propertyId}`),
    api<DpSettings>(`/pricing/settings/${propertyId}`).catch(() => null),
    api<Discount[]>(`/pricing/discounts/${propertyId}`).catch(() => []),
  ]);

  // FeWo: der (älteste) Nicht-derived-Plan trägt den Grundpreis. Fällt es auf den
  // ersten Plan zurück, falls alle derived sind (Hotel-Sonderfall greift hier nicht).
  const plan =
    rates.items.find((r) => !r.derived_from_rate_plan_id) ?? rates.items[0] ?? null;

  const los = discounts.filter(
    (d) => d.discount_type === "length_of_stay" && d.active,
  );

  return {
    basePrice: plan?.base_price ?? null,
    currency: plan?.currency ?? null,
    ratePlanId: plan?.id ?? null,
    bookingConditionId: plan?.booking_condition_id ?? null,
    bookingConditionLongId: plan?.booking_condition_long_id ?? null,
    minStay: plan?.min_stay ?? 1,
    smart:
      smart ?? {
        property_id: propertyId,
        enabled: false,
        min_price: null,
        max_price: null,
        weekend_uplift_pct: 0,
      },
    weeklyDiscount: los.find((d) => d.min_nights === 7) ?? null,
    monthlyDiscount: los.find((d) => d.min_nights === 28) ?? null,
  };
}
