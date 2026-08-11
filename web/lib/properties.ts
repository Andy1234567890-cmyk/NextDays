"use server";

// Objekt-Verwaltung: Server-Actions gegen den FastAPI-properties-Slice
// (/api/v1/properties). Business-Logik bleibt im Backend (PROJECT.md §2).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type { Fee, FeeTypeEntry } from "@/lib/pricing-meta";
import { currentToken } from "@/lib/session-token";

export type PropertyType =
  | "ferienhaus"
  | "appartement"
  | "glamping"
  | "tiny_house"
  | "stellplatz"
  | "hausboot"
  // Hotel-Zimmertypen (Migration 0098, Betriebsart 'hotel')
  | "einzelzimmer"
  | "doppelzimmer"
  | "zweibettzimmer"
  | "familienzimmer"
  | "junior_suite"
  | "suite";

export type PropertyStatus = "draft" | "active" | "inactive";

export type Property = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  // Abweichende Beschreibung nur für die eigene Buchungsseite (nicht an OTAs).
  platform_description: string | null;
  property_type: PropertyType;
  // Booking.com Unterkunftsart (PCT-Code, siehe lib/booking-property-types.ts).
  // Getrennt vom internen property_type; null = nicht gesetzt.
  booking_property_type: number | null;
  status: PropertyStatus;
  // Gebäude (0264): Objekte mit demselben Gebäude teilen sich EINE Portal-
  // Kennung (eine Booking-Hotel-ID mit mehreren Einheiten). null = das Objekt
  // steht für sich und bekommt eine eigene Kennung.
  building_id: string | null;
  // Sichtbarkeit auf dem eigenen myBestDays-Marktplatz (/plattform) als eigener
  // Buchungskanal — getrennt von status und der OTA-Distribution (Migration 0159).
  listed_on_marketplace: boolean;
  // Sichtbarkeit auf der eigenen Kunden-Website (Page-Builder) als eigener
  // Vertriebskanal (Migration 0162) — getrennt von status, Marktplatz und OTA.
  listed_on_website: boolean;
  // Zentrale Währung DES OBJEKTS (Migration 0161). Gilt für alle Rate-Plans des
  // Objekts (Channex: 1 Objekt = 1 Währung). Leer/null = noch nicht gesetzt →
  // symbollose Anzeige (lib/currency), nie ein erfundenes € (Wurzel 4).
  currency: string | null;
  max_guests: number;
  // Wohnfläche als ECHTE Spalten (0197), nicht in type_attributes: der Wert
  // ist validiert (0 < x ≤ 100000) und die Einheit auf sqm/sqft begrenzt.
  // Frühere Objekte trugen sie unter type_attributes.size_m2 — 0249 hat das
  // zusammengeführt, damit es nur eine Wahrheit gibt.
  size_value: number | null;
  size_unit: "sqm" | "sqft" | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  /** IANA-Zeitzone des Objekts ("Europe/Copenhagen"). Bestimmt, wann eine
   *  Automation mit Ortszeit auslöst. Fehlt sie, plant der Server für dieses
   *  Objekt keine Automation mit Ortszeit — statt still auf UTC auszuweichen. */
  timezone: string | null;
  // Objektkartei (Lastenheft §6): nur bfe_number (DK-Katasternummer) ist ein
  // echtes neues Kartei-Feld. Name/Typ/Adresse/Kapazität kommen aus dem Bestand
  // (title, property_type, house_number, max_guests, size_value).
  bfe_number: string | null;
  // Ende des Vermarktungsvertrags (0355) als ISO-Datum — der ERSTE Tag OHNE
  // Vertrag (Grenze ausschließlich): "2027-01-02" heißt, die Nacht 01.→02.01.
  // wird noch verkauft, die Nacht danach nicht mehr. Ab dem Tag ist das Objekt
  // auf allen Kanälen gesperrt (eigener Kalender, myBestDays, Portale).
  // null = unbefristet, kein Ersatzdatum (Wurzel 4).
  contract_end_date: string | null;
  // amenities = Objekt-Ausstattung, room_amenities = Zimmer-Ausstattung.
  // Channex führt dafür zwei Kataloge mit eigenen UUIDs (0243) — nie mischen.
  amenities: string[];
  room_amenities: string[];
  photos: string[];
  // Flexible Sektionen (Rooms, Sleeping arrangements, m², Einheiten …).
  type_attributes: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  // Abgeleiteter Kanal-Sichtbarkeitszustand (Ebene B) für die Kanal-Chips —
  // vom Backend berechnet, nicht persistiert (0162). Optional, weil nur Listen-/
  // Detail-Wege ihn liefern.
  channels?: PropertyChannels;
};

// Zustand eines Objekts PRO Vertriebskanal (Guesty/Cloudbeds/SiteMinder-Modell):
// aktiv, pausiert (Nutzer-Wille, kein Alarm), nicht eingerichtet, Fehler.
export type ChannelState = "active" | "paused" | "not_connected" | "error";

export type PropertyChannels = {
  website: ChannelState;
  marketplace: ChannelState;
  portals: ChannelState;
};

export type PropertyInput = Partial<
  Omit<Property, "id" | "tenant_id" | "created_at" | "updated_at">
> & { title?: string };

export type Building = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  /** Zahl der Objekte in diesem Gebäude. */
  unit_count: number;
};

type Result<T> =
  | { ok: true; data: T }
  // `details` trägt strukturierte Angaben aus einem Fehler weiter, wenn der
  // Text allein nicht reicht: beim Vertragsende (0355) die Liste der Buchungen,
  // die dem Enddatum im Weg stehen. Aus dem übersetzbaren Meldungstext wären
  // sie nicht rekonstruierbar.
  | {
      ok: false;
      error: string;
      status?: number;
      details?: Record<string, unknown>;
    };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    const details = exc instanceof ApiError ? exc.details : undefined;
    return { ok: false, error, status, details };
  }
}

export async function listProperties(): Promise<
  Result<{ items: Property[]; total: number }>
> {
  return call("/properties");
}

export async function getProperty(id: string): Promise<Result<Property>> {
  return call(`/properties/${id}`);
}

/** Eine Buchung, die über das Vertragsende hinausreicht (0355/0359).
 *
 *  Sie verhindert das Enddatum NICHT — eine bestätigte Portal-Buchung
 *  verschwindet nicht dadurch, dass der Vertrag endet; sie wird bedient und der
 *  Vertrag läuft für sie aus. Der Betrieb muss aber wissen, was noch
 *  abzuwickeln ist. */
export type VertragsendeBuchung = {
  id: string;
  check_in: string;
  /** Abreise (ausschließlich) — die letzte belegte Nacht ist der Tag davor. */
  check_out: string;
  gast: string;
  /** false bei OTA-Buchungen: der lokale Storno würde den Portalen verfügbar
   *  melden, während der Gast dort weiter gebucht ist (Überbuchung) — deshalb
   *  lehnt der Server ihn ab. Die Oberfläche darf dann nicht zum Stornieren
   *  auffordern, sondern muss auf das Portal verweisen. */
  lokal_stornierbar: boolean;
};

export type VertragsendeInfo = {
  contract_end_date: string | null;
  buchungen: VertragsendeBuchung[];
};

/** Vertragsende eines Objekts + die Buchungen, die darüber hinausreichen.
 *
 *  Eigener Endpunkt und nicht Teil von `getProperty`: die Liste ist eine
 *  Abfrage über `reservations` und liefe sonst bei jedem Objekt-Abruf mit,
 *  auch in der Objektliste. */
export async function getVertragsende(
  id: string,
): Promise<Result<VertragsendeInfo>> {
  return call(`/properties/${id}/vertragsende`);
}

export async function createProperty(
  input: PropertyInput,
): Promise<Result<Property>> {
  return call("/properties", { method: "POST", body: input });
}

/** Objekt veröffentlichen (draft→active): überträgt es an die Buchungsportale
 *  und füllt den Kalender. Erfordert einen hinterlegten Preis. */
export async function publishProperty(id: string): Promise<Result<Property>> {
  return call(`/properties/${id}/publish`, { method: "POST" });
}

/** Objekt-Inhalte (Beschreibung, Ausstattung, Fotos, Belegung, Adresse) erneut
 *  an die Buchungsportale übertragen — ohne Statuswechsel. */
export async function resyncProperty(id: string): Promise<Result<Property>> {
  return call(`/properties/${id}/resync`, { method: "POST" });
}

export async function updateProperty(
  id: string,
  input: PropertyInput,
): Promise<Result<Property>> {
  return call(`/properties/${id}`, { method: "PATCH", body: input });
}

export async function deleteProperty(id: string): Promise<Result<null>> {
  return call(`/properties/${id}`, { method: "DELETE" });
}

/** Eine Steuer dieses Objekts auf weitere eigene Objekte übertragen. Der
 *  Server prüft jede Ziel-ID einzeln auf den eigenen Betrieb. */
/** Die wählbaren Gebührenarten mit Bezeichnung und Portal-Kategorie.
 *
 *  Eine Fachtaxonomie mit 49 Einträgen — sie liegt serverseitig in EINER Quelle
 *  (`gebuehren.FEE_TYPE_CATEGORY`), damit Auswahlfeld und Prüfung nicht
 *  auseinanderlaufen. Deshalb geladen statt im Frontend nachgebaut. */
export async function listFeeTypes(): Promise<Result<{ items: FeeTypeEntry[] }>> {
  return call("/properties/fee-types");
}

/** Eine bestehende Gebühr des Betriebs, übernehmbar auf dieses Objekt.
 *
 *  `fee` ist der gespeicherte Eintrag selbst — die Übernahme legt genau die
 *  Gebühr an, die woanders schon steht, statt eine nachgebaute. */
export type FeeLibraryEntry = {
  fee: Fee;
  property_id: string;
  property_title: string | null;
};

/** Auswahlliste für „bestehende Gebühr hinzufügen" (Standard: `assign-fee`).
 *
 *  `currency` ist die Währung DIESES Objekts; `null` heißt „noch keine gewählt"
 *  — dann stehen nur prozentuale Gebühren zur Auswahl, weil ein Betrag ohne
 *  Währung nicht übernehmbar ist. */
export async function listFeeLibrary(
  propertyId: string,
): Promise<Result<{ currency: string | null; items: FeeLibraryEntry[] }>> {
  return call(`/properties/${propertyId}/fee-library`);
}

/** Preise (inkl. Gebühren und Steuern) von einem anderen eigenen Objekt
 *  übernehmen — Branchenstandard „Preise einer bestehenden Unterkunft kopieren".
 *
 *  Überschreibt den Preis-Block DIESES Objekts vollständig. Der Server lehnt
 *  abweichende Währungen und nicht erfüllbare Kanal-Einschränkungen ab, BEVOR er
 *  schreibt; Aktionen und Verfügbarkeit sind nicht dabei (siehe
 *  properties/preise_kopieren.py). */
export async function copyPricingFrom(
  propertyId: string,
  sourcePropertyId: string,
): Promise<
  Result<{ property_id: string; source_id: string; fees: number; taxes: number }>
> {
  return call(`/properties/${propertyId}/pricing/copy-from`, {
    method: "POST",
    body: { source_property_id: sourcePropertyId },
  });
}

/** Dieselbe Gebühr auf weitere eigene Objekte übertragen. Der Server prüft jede
 *  Ziel-ID einzeln auf den eigenen Betrieb und lehnt Währungs-/Portal-Konflikte
 *  ab, BEVOR er das erste Ziel schreibt. */
export async function applyFeeToProperties(
  propertyId: string,
  feeId: string,
  targetIds: string[],
): Promise<Result<{ applied_to: string[] }>> {
  return call(`/properties/${propertyId}/fees/${feeId}/apply`, {
    method: "POST",
    body: { property_ids: targetIds },
  });
}

export async function applyTaxToProperties(
  propertyId: string,
  taxId: string,
  targetIds: string[],
): Promise<Result<{ applied_to: string[] }>> {
  return call(`/properties/${propertyId}/taxes/${taxId}/apply`, {
    method: "POST",
    body: { property_ids: targetIds },
  });
}

/** Objekt duplizieren („Kopieren"): eigenständige Kopie als Entwurf, auf keinem
 *  Kanal sichtbar. Gibt das neu angelegte Objekt zurück. */
export async function duplicateProperty(
  id: string,
): Promise<Result<Property>> {
  return call(`/properties/${id}/duplicate`, { method: "POST" });
}

/** Website-Verbindung aufheben: schaltet nur die Website-Sichtbarkeit ab
 *  (Portale/Marktplatz bleiben unberührt). */
export async function unlistPropertyWebsite(
  id: string,
): Promise<Result<Property>> {
  return call(`/properties/${id}/unlist-website`, { method: "POST" });
}

// Bild für ein Objekt hochladen (multipart) → öffentliche URL. `slot` benennt
// die Verwendung (z. B. „custom-map"), feste Namen überschreiben das Vorbild.
export async function uploadPropertyImage(
  id: string,
  file: File,
  slot = "image",
): Promise<Result<{ url: string }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(
      `${base}/api/v1/properties/${id}/image?slot=${encodeURIComponent(slot)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as { url: string } };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

// --- Foto-/Galerieverwaltung (property_photos) -----------------------------

export type PropertyPhoto = {
  id: string;
  property_id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
  // Locale → Bildunterschrift, z. B. { de: "Wohnzimmer", en: "Living room" }.
  caption: Record<string, string>;
  // Urheber/Fotograf (an die Buchungsportale mitgesendet). null = kein Autor.
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Fotos eines Objekts, nach Reihenfolge sortiert. */
export async function listPropertyPhotos(
  id: string,
): Promise<Result<{ items: PropertyPhoto[]; total: number }>> {
  return call(`/properties/${id}/photos`);
}

/** Ein Galerie-Foto hochladen (multipart) → neue Foto-Zeile. JPEG/PNG,
 *  50 KB–20 MB (serverseitig validiert). Multi-Upload = mehrere Aufrufe. */
export async function uploadPropertyPhoto(
  id: string,
  file: File,
): Promise<Result<PropertyPhoto>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1/properties/${id}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as PropertyPhoto };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Reihenfolge der Fotos setzen (vollständige Liste der Foto-IDs). */
export async function reorderPropertyPhotos(
  id: string,
  photoIds: string[],
): Promise<Result<{ items: PropertyPhoto[]; total: number }>> {
  return call(`/properties/${id}/photos/reorder`, {
    method: "PATCH",
    body: { photo_ids: photoIds },
  });
}

/** Bildunterschrift (je Locale) und/oder Cover eines Fotos setzen. */
export async function updatePropertyPhoto(
  id: string,
  photoId: string,
  input: {
    caption?: Record<string, string>;
    is_cover?: boolean;
    author?: string;
  },
): Promise<Result<PropertyPhoto>> {
  return call(`/properties/${id}/photos/${photoId}`, {
    method: "PATCH",
    body: input,
  });
}

/** Foto löschen (Datei + Zeile); war es das Cover, wird neu vergeben. */
export async function deletePropertyPhoto(
  id: string,
  photoId: string,
): Promise<Result<null>> {
  return call(`/properties/${id}/photos/${photoId}`, { method: "DELETE" });
}

// --- Zimmer als eigene Entität (property_rooms, 0246) -----------------------
// Ein Zimmer ist eine eigene Zeile, kein Zählwerk: nur so lässt sich sagen,
// WELCHES Schlafzimmer welche Betten hat und welches Bad an welches grenzt.
// Betten, Zimmergröße und en suite bleiben lokal — Channex verwirft sie am
// Room-Type (live gemessen). Nur die Ausstattung geht als Vereinigungsmenge
// über alle Zimmer an die Portale.

export type PropertyRoom = {
  id: string;
  property_id: string;
  /** Slug wie ZIMMER_SLUGS in lib/property-meta. */
  raum_typ: string;
  privat: boolean;
  position: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PropertyRoomInput = {
  raum_typ?: string;
  privat?: boolean;
};

/** Zimmer eines Objekts in Anzeigereihenfolge. */
export async function listPropertyRooms(
  id: string,
): Promise<Result<{ items: PropertyRoom[]; total: number }>> {
  return call(`/properties/${id}/rooms`);
}

/** Zimmer anlegen; landet am Ende der Reihenfolge. */
export async function addPropertyRoom(
  id: string,
  input: PropertyRoomInput & { raum_typ: string },
): Promise<Result<PropertyRoom>> {
  return call(`/properties/${id}/rooms`, { method: "POST", body: input });
}

/** Zimmer ändern. Nicht gesetzte Felder bleiben unverändert. */
export async function updatePropertyRoom(
  id: string,
  roomId: string,
  input: PropertyRoomInput,
): Promise<Result<PropertyRoom>> {
  return call(`/properties/${id}/rooms/${roomId}`, {
    method: "PATCH",
    body: input,
  });
}

/** Zimmer löschen; eine en-suite-Kopplung darauf wird mitgelöst. */
export async function deletePropertyRoom(
  id: string,
  roomId: string,
): Promise<Result<null>> {
  return call(`/properties/${id}/rooms/${roomId}`, { method: "DELETE" });
}

/** Reihenfolge setzen (vollständige Liste der Zimmer-IDs). */
export async function reorderPropertyRooms(
  id: string,
  roomIds: string[],
): Promise<Result<{ items: PropertyRoom[]; total: number }>> {
  return call(`/properties/${id}/rooms/reorder`, {
    method: "PATCH",
    body: { room_ids: roomIds },
  });
}

// --- Gebäude (0264) ----------------------------------------------------------
// Ein Gebäude klammert die Objekte, die bei den Portalen unter EINER Kennung
// stehen (Booking: eine Unterkunft mit mehreren Einheiten). Sein Name ist der
// Name, den die Portale über den Einheiten zeigen.
export async function listBuildings(): Promise<Result<Building[]>> {
  return call("/properties/buildings");
}

export async function createBuilding(name: string): Promise<Result<Building>> {
  const res = await call<Building>("/properties/buildings", {
    method: "POST",
    body: { name },
  });
  if (res.ok) revalidatePath("/objekte");
  return res;
}

/** Einheiten eines Objekts (0265) — mindestens eine. */
export async function listUnits(
  propertyId: string,
): Promise<Result<{ id: string; name: string; position: number }[]>> {
  return call(`/properties/${propertyId}/units`);
}
