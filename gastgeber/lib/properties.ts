// Data-Layer Objekte (properties) fürs Gastgeber-Dashboard. Über den DAL
// api-server.ts (Host-Cookie-Bearer) gegen dieselben FastAPI-Endpunkte wie web,
// aber Gastgeber-Auth. Server-Read für Server Components; Mutationen als Server
// Actions in properties-actions.ts (Cookie-schreiben/revalidate nur dort).
import { api } from "./api-server";

// Objekt-Status (Lebenszyklus, getrennt von Kanal-Sichtbarkeit).
export type PropertyStatus = "draft" | "active" | "inactive";

export interface PropertyChannels {
  website?: string | null;
  marketplace?: string | null;
  portals?: string | null;
}

export interface Property {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  platform_description: string | null;
  property_type: string;
  status: PropertyStatus;
  listed_on_marketplace: boolean;
  listed_on_website: boolean;
  currency: string | null;
  max_guests: number;
  city: string | null;
  country: string | null;
  amenities: string[];
  photos: string[];
  channels: PropertyChannels | null;
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
