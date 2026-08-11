// Objekt-Daten der Mobile-App — gegen den FastAPI-properties-Slice
// (/api/v1/properties), gespiegelt aus apps/web/lib/properties.ts. Nur die
// Lesepfade, die die App aktuell braucht.
import { call, type Result } from "@/lib/api";

export type PropertyStatus = "draft" | "active" | "inactive";

// Zustand eines Objekts PRO Vertriebskanal (Spiegel von web/lib/properties.ts):
// aktiv, pausiert (Nutzer-Wille, kein Alarm), nicht eingerichtet, Fehler —
// plus `pending` NUR beim eigenen Marktplatz: gelistet, aber die Freigabe des
// Marktplatz-Betreibers fehlt noch (dort also nicht sichtbar).
export type ChannelState =
  | "active"
  | "paused"
  | "not_connected"
  | "error"
  | "pending";

export type PropertyChannels = {
  website: ChannelState;
  marketplace: ChannelState;
  portals: ChannelState;
};

export type Property = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  // Eigene Marktplatz-Beschreibung. null = es gibt keine gesonderte; dann gilt
  // `description` auch dort (kein Kopieren in der App, sonst driftet es).
  platform_description: string | null;
  property_type: string;
  listing_type: string | null;
  status: PropertyStatus;
  max_guests: number;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  // Wohnfläche. Einheit kommt mit — nie „m²" annehmen (Wurzel 4).
  size_value: number | null;
  size_unit: string | null;
  floors_total: number | null;
  floor_number: number | null;
  year_built: number | null;
  total_rooms: string | null;
  listed_on_marketplace: boolean;
  listed_on_website: boolean;
  // Slugs des Channex-Ausstattungskatalogs (Labels: lib/ausstattung.ts).
  amenities: string[];
  // DK-Katasternummer (Objektkartei §6) — dient als Objektnummer im Umschalter.
  // Leer = keine Nummer anzeigen (kein erfundener Ersatzwert).
  bfe_number: string | null;
  // Zentrale Objektwährung (properties.currency, Migration 0161) — gilt für alle
  // Rate-Plans des Objekts. null → Beträge symbollos rendern, NIE ein
  // erfundenes € (Wurzel 4). Liegt NICHT in type_attributes.
  currency: string | null;
  photos: string[];
  // Abgeleiteter Kanal-Zustand (Ebene B). Der Server befüllt ihn nur auf den
  // Listen-/Detail-Wegen; fehlt er, werden keine Chips gerendert.
  channels?: PropertyChannels;
  type_attributes: Record<string, unknown>;
};

// Deutsche Typ-Labels (Spiegel von apps/web/lib/property-meta.ts TYPE_LABELS).
const TYPE_LABELS: Record<string, string> = {
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

export function propertyTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export async function listProperties(): Promise<Result<{ items: Property[]; total: number }>> {
  return call("/properties");
}

export async function getProperty(id: string): Promise<Result<Property>> {
  return call(`/properties/${id}`);
}

/**
 * Teil-Aktualisierung eines Objekts (PATCH /properties/{id}). Bewusst nur die
 * Felder senden, die wirklich geändert wurden — der Endpoint ist ein PATCH,
 * ein vollständiges Objekt zurückzuschreiben würde fremde Änderungen
 * überbügeln. Die Berechtigung prüft der Server (manage_properties).
 */
export async function updateProperty(
  id: string,
  aenderung: Partial<Pick<Property, "description" | "platform_description">>,
): Promise<Result<Property>> {
  return call(`/properties/${id}`, { method: "PATCH", body: aenderung });
}
