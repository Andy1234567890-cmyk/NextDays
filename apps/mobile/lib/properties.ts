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
  status: PropertyStatus;
  max_guests: number;
  city: string | null;
  country: string | null;
  photos: string[];
  type_attributes: Record<string, unknown>;
};

export async function listProperties(): Promise<Result<{ items: Property[]; total: number }>> {
  return call("/properties");
}

export async function getProperty(id: string): Promise<Result<Property>> {
  return call(`/properties/${id}`);
}
