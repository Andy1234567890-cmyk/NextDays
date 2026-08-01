// Betriebs-eigene Zusatzfelder für Objekte — gegen den FastAPI-Slice
// /api/v1/property-fields (Migration 0242). Typen exakt am Pydantic-Contract
// (property_custom_fields/schemas.py); nullable bleibt nullable.
//
// Alle Werte sind Text, auch Zahlen und Ja/Nein — der Feldtyp steht in der
// Definition und bestimmt nur Tastatur und Eingabemaske.
import { call, type Result } from "@/lib/api";

export type FeldTyp = "text" | "textarea" | "number" | "select" | "checkbox";

export type Zusatzfeld = {
  id: string;
  tenant_id: string;
  field_key: string;
  label: string;
  field_type: FeldTyp;
  options: string[];
  // Nur ein Merkmal, KEINE Freischaltung: Sichtbarkeit im Gastportal wird
  // dort durchgesetzt, nicht durch dieses Flag (Wurzel 6).
  is_public: boolean;
  sort_order: number;
};

export type ZusatzfeldMitWert = {
  field: Zusatzfeld;
  // null = für dieses Objekt nie gesetzt. Die UI zeigt „—", nicht „0"/„nein".
  value: string | null;
};

export const TYP_LABEL: Record<FeldTyp, string> = {
  text: "Text",
  textarea: "Mehrzeiliger Text",
  number: "Zahl",
  select: "Auswahl",
  checkbox: "Ja / Nein",
};

/** Alle Felder des Betriebs mit dem Wert dieses Objekts (auch die leeren). */
export async function listZusatzfelder(
  propertyId: string,
): Promise<Result<ZusatzfeldMitWert[]>> {
  return call(`/property-fields/values/${propertyId}`);
}

/** Wert setzen; `null` löscht ihn. */
export async function setZusatzfeldWert(
  propertyId: string,
  fieldId: string,
  value: string | null,
): Promise<Result<ZusatzfeldMitWert>> {
  return call(`/property-fields/values/${propertyId}/${fieldId}`, {
    method: "PUT",
    body: { value },
  });
}
