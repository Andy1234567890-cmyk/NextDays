"use server";

// Promotions (Sonderangebote/Rabatte) eines Objekts — Server-Actions gegen den
// FastAPI-Slice `property_discounts` (/api/v1/pricing/discounts).
//
// WARUM NICHT IM PREIS-BLOB: eine Promotion ist eine PREISREGEL, keine
// Beschreibung. Sie hat Bedingungen (Zeitraum, Nächte, Vorlauf, Angebotscode),
// wird vom Preis-Resolver ausgewertet, geht über den Tagespreis an alle Portale
// und über Airbnbs Rabattregeln auch mit Bedingung — dafür braucht sie eigene
// Spalten mit CHECKs, RLS und einer Kennung, auf die der Server sich beziehen
// kann. Im `type_attributes.pricing`-Blob lag früher eine Kopie mit einem
// FREITEXT-Feld „conditions", das niemand auswertete: „20 % nur Juni" zog 20 %
// von JEDER Buchung ab. Diese Form ist bewusst abgeschafft.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/** Ein Aufenthaltszeitraum, in dem die Promotion gilt (beide Tage inklusiv). */
export type StayRange = { from: string; to: string };

/** Prozent oder Pauschalbetrag in der Währung DES OBJEKTS. */
export type DiscountKind = "percent" | "fixed";

export type Promotion = {
  id: string;
  property_id: string;
  /** Fachliche Art. Aus der Promotions-Oberfläche immer `promotion`: die drei
   *  Kurven-Typen (length_of_stay/early_booker/last_minute) dürfen je Objekt nur
   *  EINMAL aktiv sein — eine Sommer- UND eine Winteraktion mit Mindestaufenthalt
   *  wären damit unmöglich. */
  discount_type: string;
  discount_kind: DiscountKind;
  /** 100 = 1,00 %. Nur bei `percent` maßgeblich. */
  discount_bps: number;
  discount_amount: number | null;
  active: boolean;
  // --- Bedingungen, alle optional, alle UND-verknüpft ----------------------
  min_nights: number | null;
  lead_min_days: number | null;
  lead_max_days: number | null;
  stay_ranges: StayRange[];
  booked_from: string | null;
  booked_to: string | null;
  promo_codes: string[];
  portal_scope: string[];
  // --- Darstellung ---------------------------------------------------------
  name: Record<string, string>;
  description_html: string | null;
  photo_url: string | null;
};

/** Was beim Anlegen/Ändern gesendet wird. `discount_bps` ist bei `percent`
 *  PFLICHT — der Server lehnt eine Prozent-Aktion ohne Satz ab, statt still
 *  0,01 % anzunehmen. */
export type PromotionInput = {
  discount_type?: string;
  discount_kind?: DiscountKind;
  discount_bps?: number;
  discount_amount?: number | null;
  active?: boolean;
  min_nights?: number | null;
  lead_min_days?: number | null;
  lead_max_days?: number | null;
  stay_ranges?: StayRange[];
  booked_from?: string | null;
  booked_to?: string | null;
  promo_codes?: string[];
  portal_scope?: string[];
  name?: Record<string, string>;
  description_html?: string | null;
  photo_url?: string | null;
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
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Eine bestehende Promotion des Betriebs, übernehmbar auf dieses Objekt. */
export type PromotionLibraryEntry = {
  promotion: Promotion;
  property_id: string;
  property_title: string | null;
};

/** Auswahlliste für „bestehende Promotion hinzufügen".
 *
 *  `currency` ist die Währung DIESES Objekts; `null` heißt „noch keine gewählt"
 *  — dann stehen nur Prozent-Promotions zur Auswahl, weil eine Pauschale ohne
 *  Währung nicht übernehmbar ist. */
export async function listPromotionLibrary(
  propertyId: string,
): Promise<Result<{ currency: string | null; items: PromotionLibraryEntry[] }>> {
  return call(`/pricing/discounts/${propertyId}/library`);
}

export async function listPromotions(
  propertyId: string,
): Promise<Result<Promotion[]>> {
  return call(`/pricing/discounts/${propertyId}`);
}

export async function createPromotion(
  propertyId: string,
  input: PromotionInput,
): Promise<Result<Promotion>> {
  return call(`/pricing/discounts/${propertyId}`, { method: "POST", body: input });
}

export async function updatePromotion(
  propertyId: string,
  promotionId: string,
  input: PromotionInput,
): Promise<Result<Promotion>> {
  return call(`/pricing/discounts/${propertyId}/${promotionId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deletePromotion(
  propertyId: string,
  promotionId: string,
): Promise<Result<null>> {
  return call(`/pricing/discounts/${propertyId}/${promotionId}`, {
    method: "DELETE",
  });
}

/** Dieselbe Promotion auf weitere eigene Objekte übertragen. Jede Ziel-ID wird
 *  serverseitig einzeln auf den eigenen Betrieb geprüft; eine fachlich gleiche
 *  Promotion wird am Ziel nicht doppelt angelegt. */
export async function applyPromotionToProperties(
  propertyId: string,
  promotionId: string,
  targetIds: string[],
): Promise<Result<{ applied_to: string[] }>> {
  return call(`/pricing/discounts/${propertyId}/${promotionId}/apply`, {
    method: "POST",
    body: { property_ids: targetIds },
  });
}
