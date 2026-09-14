"use server";

// Zentrale Preis-Auflösung (eine Preis-Wahrheit) — Server-Actions gegen den
// FastAPI-pricing-Slice (/api/v1/pricing). Der Resolver vereint price_overrides
// (Tag) > Wochentagspreis > rate_plans.base_price und wendet Aufschläge/Gebühren/
// Steuern/Aktionen an. Kalender, Wizard und Buchung lesen Preise ausschließlich
// hierüber — nie direkt aus Tabellen.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

// `kind` klassifiziert die Zeile (lodging|surcharge|fee|discount|tax|addon) —
// der Beleg-Editor leitet daraus Basis und Steuersatz ab (0701).
export type QuoteLine = { label: string; amount: number; kind?: string | null };

export type Quote = {
  property_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  channel: string;
  currency: string;
  nightly_total: number;
  lines: QuoteLine[];
  total: number;
  // true, wenn das Objekt keinen bepreisbaren Tag hat → Aufrufer muss manuell
  // bepreisen statt 0 anzuzeigen (kein erfundener Preis).
  priceless: boolean;
};

export type EffectivePriceDay = {
  date: string;
  price: number | null;
  source: string; // override | weekday | base | none
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
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

/** Vollständige Preisaufschlüsselung eines Aufenthalts (für Wizard/Buchung). */
export async function getQuote(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  /** Mitgebrachte Tiere — multipliziert Gebühren „pro Tier / Aufenthalt". */
  pets?: number;
  channel: string;
}): Promise<Result<Quote>> {
  return call("/pricing/quote", { method: "POST", body: input });
}

/** Effektivpreis je Tag [start, end) — override > weekday > base, sonst null. */
export async function getEffectivePrices(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<EffectivePriceDay[]>> {
  const qs = `?property_id=${encodeURIComponent(propertyId)}&start=${start}&end=${end}`;
  return call(`/pricing/effective${qs}`);
}
