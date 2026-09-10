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
  aenderung: Partial<
    Pick<Property, "description" | "platform_description" | "type_attributes">
  >,
): Promise<Result<Property>> {
  return call(`/properties/${id}`, { method: "PATCH", body: aenderung });
}

/**
 * Die Nutzlast fürs Anlegen aus den Formularfeldern — als eigene Funktion,
 * weil hier die stille Falle sitzt: ein nicht ausgefülltes Feld darf NICHT
 * als leere Zeichenkette mitgehen. `street: ""` ist in der Datenbank von
 * „nicht erfasst" nicht mehr zu unterscheiden, und die Adresse ist genau das,
 * was vor Ort oft noch fehlt (Wurzel 4).
 *
 * `max_guests` geht nur mit, wenn es eine ganze Zahl ≥ 1 ist: der Server
 * lehnt alles andere mit 422 ab, und ein „2,5" aus dem Zahlenfeld soll nicht
 * die ganze Anlage scheitern lassen, sondern schlicht ungesetzt bleiben.
 */
export function anlageNutzlast(eingabe: {
  titel: string;
  typ: string;
  gaeste: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
}): { title: string; property_type: string } & Record<string, unknown> {
  const zahl = Number(eingabe.gaeste);
  const nurWennGesetzt = (feld: string, wert: string) =>
    wert.trim() ? { [feld]: wert.trim() } : {};
  return {
    title: eingabe.titel.trim(),
    property_type: eingabe.typ,
    ...(Number.isInteger(zahl) && zahl >= 1 ? { max_guests: zahl } : {}),
    ...nurWennGesetzt("street", eingabe.strasse),
    ...nurWennGesetzt("house_number", eingabe.hausnummer),
    ...nurWennGesetzt("postal_code", eingabe.plz),
    ...nurWennGesetzt("city", eingabe.ort),
  };
}

/**
 * Objekt anlegen (POST /properties) — der Weg für die Agentur, die beim Kunden
 * VOR ORT steht. Pflicht ist allein `title`; alles Weitere ist optional, weil
 * vor Ort selten alles bekannt ist und ein erzwungenes Feld sonst zu einem
 * erfundenen Wert führt (Wurzel 4). Was fehlt, wird später in der Kartei
 * ergänzt.
 *
 * NICHT gesendet wird `listed_on_marketplace`: myBestDays ist Pflichtkanal
 * (0527), der Server setzt es ohnehin auf true, und ein `false` würde mit 422
 * abgelehnt. Die Berechtigung (MANAGE_PROPERTY_SETTINGS) prüft der Server.
 */
export async function createProperty(neu: {
  title: string;
  property_type?: string;
  max_guests?: number;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  currency?: string | null;
}): Promise<Result<Property>> {
  return call("/properties", { method: "POST", body: neu });
}
