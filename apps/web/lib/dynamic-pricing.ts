"use server";

// Dynamic-Pricing-Einstellungen je Objekt — Server-Actions gegen den FastAPI-
// pricing-Slice (/api/v1/pricing/settings/{property_id}). Die Regel-Engine
// berechnet täglich dynamic_prices; ein manueller price_override gewinnt immer.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type LastMinuteRule = { days_before: number; discount_pct: number };

export type DpSettings = {
  property_id: string;
  enabled: boolean;
  min_price: number | null;
  max_price: number | null;
  weekend_uplift_pct: number;
  last_minute: LastMinuteRule[];
  orphan_gap_discount_pct: number;
  occupancy_sensitivity: number;
  min_stay_min: number;
  min_stay_max: number;
  // Phase 2: Markt-/Wettbewerbs-Signal (opt-in zusätzlich zu enabled).
  market_enabled: boolean;
  market_sensitivity: number;
  market_max_adjust_pct: number;
  market_key: string | null;
  comp_refs: string[];
};

export type DpSettingsInput = Partial<Omit<DpSettings, "property_id">>;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PUT"; body?: unknown } = {},
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

/** Dynamic-Pricing-Einstellungen eines Objekts (Defaults, falls noch leer). */
export async function getDpSettings(
  propertyId: string,
): Promise<Result<DpSettings>> {
  return call(`/pricing/settings/${encodeURIComponent(propertyId)}`);
}

/** Dynamic-Pricing-Einstellungen setzen (Upsert; bei enabled sofortiger Recompute). */
export async function saveDpSettings(
  propertyId: string,
  input: DpSettingsInput,
): Promise<Result<DpSettings>> {
  return call(`/pricing/settings/${encodeURIComponent(propertyId)}`, {
    method: "PUT",
    body: input,
  });
}
