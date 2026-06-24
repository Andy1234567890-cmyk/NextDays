"use server";

// Dynamic-Pricing-Einstellungen je Objekt — Server-Actions gegen den FastAPI-
// pricing-Slice (/api/v1/pricing/settings/{property_id}). Die Regel-Engine
// berechnet täglich dynamic_prices; ein manueller price_override gewinnt immer.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type LastMinuteRule = { days_before: number; discount_pct: number };

// Manuelle Rate Rule (KI + Fachwissen): Trefferkriterien → Auf-/Abschlag.
export type RateRuleMatch = {
  weekday?: number | number[];
  month?: number | number[];
  min_days_before?: number;
  max_days_before?: number;
};
export type RateRule = { match: RateRuleMatch; adjust_pct: number };

// Basispreis-Modus (Hostaway-Modell).
export type BaseMode = "data_driven" | "manual";
export type BaseRateMode = "conservative" | "recommended" | "aggressive";

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
  // Hostaway-Modell: Basispreis-Modus + Aggressivität.
  base_mode: BaseMode;
  base_rate_mode: BaseRateMode;
  manual_base_price: number | null;
  // Phase 4 / RateBoard-Bausteine.
  autopilot_enabled: boolean;
  weather_enabled: boolean;
  weather_max_adjust_pct: number;
  rate_rules: RateRule[];
};

export type DpSettingsInput = Partial<Omit<DpSettings, "property_id">>;

/** Eine Zeile der Dynamic-Pricing-Objekt-Übersicht (Hostaway-Tabelle). */
export type DpOverviewItem = {
  property_id: string;
  title: string;
  photo: string | null;
  status: "draft" | "active" | "inactive";
  currency: string | null;
  enabled: boolean;
  base_mode: BaseMode;
  base_rate_mode: BaseRateMode;
  base_rate: number | null;
  min_price: number | null;
  max_price: number | null;
  // Verteilkanäle, auf denen das Objekt live ist: "platform" + OTA-Portal-Codes.
  channels: string[];
};

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

/** Alle Objekte des Kontos mit ihrem Dynamic-Pricing-Status (Hostaway-Tabelle). */
export async function getDpOverview(): Promise<
  Result<{ items: DpOverviewItem[] }>
> {
  return call(`/pricing/overview`);
}

/** Dynamic-Pricing-Einstellungen eines Objekts (Defaults, falls noch leer). */
export async function getDpSettings(
  propertyId: string,
): Promise<Result<DpSettings>> {
  return call(`/pricing/settings/${encodeURIComponent(propertyId)}`);
}

/** KI-Klartext-Begründung für den dynamischen Preis eines Tages (on-demand). */
export async function explainDpPrice(
  propertyId: string,
  day: string,
): Promise<Result<{ property_id: string; date: string; price: number; explanation: string }>> {
  return call(
    `/pricing/explain/${encodeURIComponent(propertyId)}?day=${encodeURIComponent(day)}`,
  );
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
