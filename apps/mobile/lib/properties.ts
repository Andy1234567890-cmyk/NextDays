// Objekt-Daten der Mobile-App — gegen den FastAPI-properties-Slice
// (/api/v1/properties), gespiegelt aus apps/web/lib/properties.ts. Nur die
// Lesepfade, die die App aktuell braucht.
import { call, type Result } from "@/lib/api";

export type PropertyStatus = "draft" | "active" | "inactive";

export type Property = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  property_type: string;
  status: PropertyStatus;
  max_guests: number;
  city: string | null;
  country: string | null;
  // DK-Katasternummer (Objektkartei §6) — dient als Objektnummer im Umschalter.
  // Leer = keine Nummer anzeigen (kein erfundener Ersatzwert).
  bfe_number: string | null;
  photos: string[];
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
