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
  // Hotel: Zimmerkategorie des Plans (null = Ferienwohnung). Erlaubt der UI, die
  // Pläne je Kategorie zu gruppieren (BAR/B&B je Room-Type).
  room_type_id: string | null;
  // Anzahl gesetzter Datumspreise (rate_plan_price_overrides); 0 = nur Basispreis.
  date_price_count: number;
  // Sync-Status DB↔Portale: 'synced' = Preise sind übertragen, 'pending' =
  // Abweichung/noch nicht abgeglichen, null = kein Datumspreis (nichts zu tun).
  sync_status: "synced" | "pending" | null;
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

// --- Hotel-Rate-Grid (Kalender-Ansicht „Preise") --------------------------

export type RateGridDay = {
  date: string;
  price: number | null;
  // 'rate_plan' (Datumspreis) | 'override' | 'dynamic' | 'weekday' | 'base' | 'none'
  source: string;
};

export type RateGridPlan = {
  id: string;
  name: string;
  currency: string;
  base_price: number;
  min_stay: number;
  sync_status: "synced" | "pending" | null;
  days: RateGridDay[];
};

export type RateGridRoomType = {
  id: string;
  title: string;
  plans: RateGridPlan[];
};

export type RateGridResponse = {
  property_id: string;
  room_types: RateGridRoomType[];
};

/** Tageskurven aller Rate-Pläne eines Hotels [from, to) — dieselbe Preis-Wahrheit
 *  wie Quote und Portale (zentraler Resolver, kein zweiter Preis-Pfad). */
export async function getRateGrid(
  propertyId: string,
  fromIso: string,
  toIso: string,
): Promise<Result<RateGridResponse>> {
  const q = new URLSearchParams({
    property_id: propertyId,
    date_from: fromIso,
    date_to: toIso,
  });
  return call(`/rates/grid?${q.toString()}`);
}

export async function listRatePlans(
  propertyId: string,
): Promise<Result<{ items: RatePlan[]; total: number }>> {
  return call(`/rates?property_id=${encodeURIComponent(propertyId)}`);
}

/** Einen Rate-Plan anlegen — Hotel: einer Zimmerkategorie zugeordnet (roomTypeId),
 *  damit mehrere Pläne je Kategorie (BAR, B&B …) mit eigenem Preis entstehen. Die
 *  Währung wird IMMER explizit übergeben (kein EUR-Default — Zert läuft auf USD). */
export async function createRatePlan(input: {
  propertyId: string;
  name: string;
  basePrice: number;
  currency: string;
  minStay?: number;
  roomTypeId?: string;
}): Promise<Result<RatePlan>> {
  return call("/rates", {
    method: "POST",
    body: {
      property_id: input.propertyId,
      name: input.name,
      base_price: input.basePrice,
      currency: input.currency,
      min_stay: input.minStay ?? 1,
      ...(input.roomTypeId ? { room_type_id: input.roomTypeId } : {}),
    },
  });
}

/** Einen Rate-Plan aktualisieren (Name/Preis/Währung/Mindestaufenthalt). */
export async function updateRatePlan(
  id: string,
  patch: { name?: string; basePrice?: number; currency?: string; minStay?: number },
): Promise<Result<RatePlan>> {
  return call(`/rates/${id}`, {
    method: "PATCH",
    body: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.basePrice !== undefined ? { base_price: patch.basePrice } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.minStay !== undefined ? { min_stay: patch.minStay } : {}),
    },
  });
}

/** Einen Rate-Plan löschen. */
export async function deleteRatePlan(id: string): Promise<Result<null>> {
  return call(`/rates/${id}`, { method: "DELETE" });
}

// Datumsgenauer Preis EINES Rate-Plans (Hotel: Twin/BAR ≠ Double/B&B am selben
// Tag). Gilt identisch auf allen 3 Vertriebswegen; kein Kanal-Split (nur Sperren
// sind kanalgetrennt). Realtime-Tabelle: rate_plan_price_overrides.
export type RatePlanPriceDay = { date: string; price: number };

/** Datumsgenaue Preise eines Rate-Plans (nur gesetzte Tage). */
export async function listRatePlanPrices(
  ratePlanId: string,
): Promise<Result<{ rate_plan_id: string; items: RatePlanPriceDay[] }>> {
  return call(`/rates/${ratePlanId}/prices`);
}

/** Datumspreis für [start, end) setzen (end exklusiv). `price=null` nimmt den
 *  Datumspreis zurück (Basispreis gilt wieder). Push an GENAU diesen Rate-Plan. */
export async function setRatePlanPrices(
  ratePlanId: string,
  start: string,
  end: string,
  price: number | null,
): Promise<Result<{ rate_plan_id: string; items: RatePlanPriceDay[] }>> {
  return call(`/rates/${ratePlanId}/prices`, {
    method: "PUT",
    body: { start, end, price },
  });
}

/** ALLE Datumspreise eines Rate-Plans zurücknehmen (Basispreis gilt wieder). */
export async function clearAllRatePlanPrices(
  ratePlanId: string,
): Promise<Result<{ rate_plan_id: string; items: RatePlanPriceDay[] }>> {
  return call(`/rates/${ratePlanId}/prices`, { method: "DELETE" });
}

/** 'Jetzt übertragen': Desired-State-Reconcile (DB↔Portale) für das Objekt
 *  anstoßen. Der Abgleich läuft asynchron; der Sync-Status aktualisiert sich
 *  danach live über rate_plan_sync_state. */
export async function resyncRatePlanPrices(
  ratePlanId: string,
): Promise<Result<{ status: string }>> {
  return call(`/rates/${ratePlanId}/prices/resync`, { method: "POST" });
}

// Datumsgenauer Mindestaufenthalt EINES Rate-Plans (Hotel). Analog zu den
// Datumspreisen; Realtime-Tabelle: rate_plan_min_stay_overrides.
export type RatePlanMinStayDay = { date: string; min_stay: number };

/** Datumsgenaue Mindestaufenthalte eines Rate-Plans (nur gesetzte Tage). */
export async function listRatePlanMinStays(
  ratePlanId: string,
): Promise<Result<{ rate_plan_id: string; items: RatePlanMinStayDay[] }>> {
  return call(`/rates/${ratePlanId}/min-stays`);
}

/** Datumsgenauen Mindestaufenthalt für [start, end) setzen (end exklusiv).
 *  `min_stay=null` nimmt ihn zurück (Rate-Plan-Default gilt wieder). */
export async function setRatePlanMinStays(
  ratePlanId: string,
  start: string,
  end: string,
  minStay: number | null,
): Promise<Result<{ rate_plan_id: string; items: RatePlanMinStayDay[] }>> {
  return call(`/rates/${ratePlanId}/min-stays`, {
    method: "PUT",
    body: { start, end, min_stay: minStay },
  });
}

/** ALLE datumsgenauen Mindestaufenthalte eines Rate-Plans zurücknehmen. */
export async function clearAllRatePlanMinStays(
  ratePlanId: string,
): Promise<Result<{ rate_plan_id: string; items: RatePlanMinStayDay[] }>> {
  return call(`/rates/${ratePlanId}/min-stays`, { method: "DELETE" });
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
