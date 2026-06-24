"use server";

// Preispläne (rate_plans) pro Objekt — Server-Actions gegen den FastAPI-rates-
// Slice (/api/v1/rates). Die rate_plans-Tabelle ist die Channex-Wahrheit für den
// Basispreis; Anlegen/Ändern löst im Backend den Channex-Sync aus.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type RatePlan = {
  id: string;
  property_id: string;
  name: string;
  base_price: number;
  currency: string;
  min_stay: number;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

export async function listRatePlans(
  propertyId: string,
): Promise<Result<{ items: RatePlan[]; total: number }>> {
  return call(`/rates?property_id=${encodeURIComponent(propertyId)}`);
}

/** Basispreis eines Objekts setzen: Upsert im Backend (ersten rate_plan ändern
 *  oder anlegen) in EINEM Round-Trip — der Basispreis landet immer, auch beim
 *  ersten Speichern, ohne Race-Dublette. Schließt die Kette zu Channex (Sync). */
export async function setBasePrice(
  propertyId: string,
  basePrice: number,
  currency: string,
  minStay = 1,
): Promise<Result<RatePlan>> {
  return call("/rates/base-price", {
    method: "PUT",
    body: {
      property_id: propertyId,
      name: "Standard",
      base_price: basePrice,
      currency,
      min_stay: minStay,
    },
  });
}

/** Mindestaufenthalt im rate_plan aktualisieren (nur wenn schon ein rate_plan
 *  existiert — ohne Basispreis gibt es keinen Plan). */
export async function setMinStay(
  propertyId: string,
  minStay: number,
): Promise<Result<RatePlan> | { ok: true; data: null }> {
  const existing = await listRatePlans(propertyId);
  if (!existing.ok || existing.data.items.length === 0) {
    return { ok: true, data: null }; // kein Plan → nichts zu tun (noch kein Preis)
  }
  return call(`/rates/${existing.data.items[0].id}`, {
    method: "PATCH",
    body: { min_stay: minStay },
  });
}
