// Data-Layer Objekte (properties) fürs Gastgeber-Dashboard. Über den DAL
// api-server.ts (Host-Cookie-Bearer) gegen dieselben FastAPI-Endpunkte wie web,
// aber Gastgeber-Auth. Read-only Server-Read für Server Components; Schreib-
// Actions kommen mit dem Onboarding-Bereich (01) als eigene "use server"-Datei.
import { api } from "./api-server";

// Objekt-Status (Lebenszyklus, getrennt von Kanal-Sichtbarkeit).
export type PropertyStatus = "draft" | "active" | "inactive";

export interface PropertyChannels {
  website?: string | null;
  marketplace?: string | null;
  portals?: string | null;
}

// Flexible Detailfelder im jsonb type_attributes (aus dem Wizard). Nur die für
// den Editor relevanten Teile typisiert; der Rest bleibt offen. Werte können
// fehlen → UI rendert dann „—"/„Noch nicht hinterlegt" (kein Fake, Wurzel 4).
export interface PropertyAttributes {
  beds?: number;
  bedrooms?: number;
  bathrooms_private?: number;
  bathrooms_shared?: number;
  size_m2?: number;
  rooms?: string[];
  // Preis-Blob aus dem Wizard (Legacy). Die WAHRE Preisquelle des Editors ist
  // NICHT dieser Blob, sondern rate_plans/dp_settings/property_discounts (siehe
  // lib/preise.ts) — der Resolver/Kalender/Quote lesen ausschließlich dort.
  pricing?: {
    basePrice?: number;
    currency?: string;
  };
  // Verfügbarkeit/Verkaufssteuerung (Airbnb „Availability"). Die WERTE hier werden
  // real vom Channex-Content-Sync gelesen (channel_manager/common.py
  // _availability_settings) und als Property-Restrictions an die Portale gepusht —
  // KEIN toter Blob. Ausnahme: der objektweite Mindestaufenthalt lebt NICHT hier,
  // sondern als rate_plans.min_stay (siehe lib/verfuegbarkeit.ts). maxStay: 0 =
  // keine Obergrenze. cutOffDays: Verkaufsstopp N Tage vor Anreise (Vorlaufzeit).
  // cutOffTime "HH:MM": Same-Day-Stopp ab Uhrzeit. maxDayAdvance: Buchungsfenster
  // (ferne Zukunft schließen). minStayType: Geltung des Mindestaufenthalts.
  availability?: {
    minStay?: number;
    maxStay?: number;
    cutOffDays?: number;
    cutOffTime?: string;
    maxDayAdvance?: number;
    minStayType?: "both" | "arrival" | "through";
  };
  // Schlafmöglichkeiten je Zimmer (Airbnb „Sleeping arrangements"): Zimmer-ID →
  // Bett-Typ-Schlüssel → Anzahl. Lebt im bestehenden type_attributes-jsonb, KEINE
  // eigene Tabelle. Fehlt = keine Betten gepflegt.
  sleeping?: Record<string, Record<string, number>>;
  // Privatsphäre je Zimmer (Airbnb „Privacy info"): Türschloss vorhanden + Typ.
  // hasLock=false: kein Schloss. hasLock=true ohne lockType: gemeldet, Typ offen.
  privacy?: Record<
    string,
    { hasLock: boolean; lockType: "inside_only" | "inside_outside" | null }
  >;
  // Barrierefreiheit (Airbnb „Accessibility features"): Merkmal-Slug → { has }.
  // Objektweit (nicht pro Zimmer). Merkmale mit Channex-Gegenstück werden zusätzlich
  // in properties.amenities gespiegelt (OTA-Sync); die Demofotos werden NIE
  // gespeichert (nur Vorlage).
  accessibility?: Record<string, { has: boolean }>;
  // Kachelbild je Zimmer (Zimmer-ID → Foto-URL aus der Objekt-Galerie). EINE
  // Quelle, geteilt zwischen Fototour und Schlafmöglichkeiten (Airbnb: ein Foto
  // pro Zimmer). Reine Editor-Zuordnung; die Foto-Wahrheit bleibt properties.photos.
  roomPhotos?: Record<string, string>;
  // Standort-Zusatzangaben (Airbnb „Location"), objektweit. Die eigentliche
  // Adresse + lat/lng liegen in den Top-Level-Property-Spalten; hier nur die
  // Editor-Zusätze. features/views = Slug-Listen (lage-katalog.ts).
  location?: {
    // „Genaue Lage zeigen" (Airbnb „Show precise location"). Default false =
    // ungefähre Lage (Umkreis) — Datenschutz-schonender Standard.
    preciseLocation?: boolean;
    features?: string[]; // Location features
    views?: string[]; // Scenic views
    neighborhood?: string; // Freitext „Neighborhood description"
    gettingAround?: string; // Freitext „Getting around"
  };
  // Belegung (Airbnb „Number of guests"), objektweit. Erwachsene = max_guests
  // (Top-Level-Spalte, NICHT hier). Hier nur Kinder-/Kleinkindplätze + Zimmeranzahl
  // — 1:1 die Channex-Room-Type-Felder occ_children/occ_infants/count_of_rooms
  // (content_sync.py _room_type_occupancy). NUR als Objekt gültig.
  occupancy?: { rooms?: number; children?: number; infants?: number };
  // Reisetyp-Tags aus dem Anlage-Wizard („Wer wohnt hier?"). Eigener Key, damit sie
  // nicht mit dem Belegungs-Objekt occupancy kollidieren.
  occupancyTags?: string[];
  [key: string]: unknown;
}

// Angebotsart (Airbnb „Listing type", public.listing_type, Migration 0198).
export type ListingType = "entire_place" | "private_room" | "shared_room";

export interface Property {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  platform_description: string | null;
  // Legacy-Objekttyp-Enum (bleibt für Bestand/Channex-Fallback).
  property_type: string;
  // Objekt-Taxonomie (0198): Kategorie → Immobilientyp → Angebotsart.
  category_slug: string | null;
  subtype_slug: string | null;
  listing_type: ListingType | null;
  total_rooms: string | null;
  // Booking.com-Unterkunftsart des Betriebs (PCT-Code) — eigene Achse.
  booking_property_type: number | null;
  // Airbnb-Zusatzfelder (Gebäude/Fläche, Migration 0197).
  floors_total: number | null;
  floor_number: number | null;
  year_built: number | null;
  size_value: number | null;
  size_unit: string | null;
  status: PropertyStatus;
  listed_on_marketplace: boolean;
  listed_on_website: boolean;
  currency: string | null;
  max_guests: number;
  // Standort (aus dem Lage-Schritt). Für den Umkreis-Preisvergleich (Karte).
  lat: number | null;
  lng: number | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  amenities: string[];
  photos: string[];
  channels: PropertyChannels | null;
  type_attributes: PropertyAttributes;
  created_at: string | null;
  updated_at: string | null;
}

interface PropertyList {
  items: Property[];
  total: number;
}

/** Alle Objekte des eingeloggten Gastgebers (Server Component). */
export async function getProperties(): Promise<Property[]> {
  const res = await api<PropertyList>("/properties");
  return res.items;
}

/** Ein Objekt per ID (tenant-gescopet serverseitig). */
export async function getProperty(id: string): Promise<Property> {
  return api<Property>(`/properties/${id}`);
}
