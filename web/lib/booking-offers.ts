"use server";

// Buchungsangebote (Lastenheft §2.2, Migration 0586): Server-Actions gegen den
// FastAPI-Slice /api/v1/booking-offers.
//
// WAS HIER NICHT STEHT: die öffentliche Annahmeseite. Sie läuft ohne Anmeldung
// über /api/v1/public/offers/{token} und wird vom Renderer (`builder`) direkt
// aufgerufen — dieser Client trägt immer ein Sitzungstoken und wäre dort
// falsch.
//
// "use server": nur async functions exportieren. Typen und Wertelisten liegen
// deshalb in `booking-offers-meta.ts` — ein `export const` hier legt die Seite
// mit 500 lahm („A 'use server' file can only export async functions"), und
// weder tsc noch ESLint sehen das.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

import type {
  BookingOffer,
  BookingOfferCreate,
  BookingOfferList,
} from "./booking-offers-meta";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; requestId?: string };

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
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
      status: exc instanceof ApiError ? exc.status : undefined,
      requestId: exc instanceof ApiError ? exc.requestId : undefined,
    };
  }
}

/** Angebote des Betriebs, neueste zuerst. `status` filtert auf einen Zustand. */
export async function listOffers(params: {
  status?: string;
  propertyId?: string;
  limit?: number;
  offset?: number;
}): Promise<Result<BookingOfferList>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.propertyId) qs.set("property_id", params.propertyId);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  return call(`/booking-offers?${qs.toString()}`);
}

/** Ein Angebot anlegen. Preis und Währung rechnet der Server. */
export async function createOffer(
  req: BookingOfferCreate,
): Promise<Result<BookingOffer>> {
  return call("/booking-offers", { method: "POST", body: req });
}

export async function getOffer(id: string): Promise<Result<BookingOffer>> {
  return call(`/booking-offers/${id}`);
}

/** Angebotsmail an den Gast schicken (auch erneut). */
export async function sendOffer(id: string): Promise<Result<BookingOffer>> {
  return call(`/booking-offers/${id}/send`, { method: "POST" });
}

/** Angebot zurückziehen; der Link des Gastes wird unbrauchbar. */
export async function cancelOffer(id: string): Promise<Result<BookingOffer>> {
  return call(`/booking-offers/${id}/cancel`, { method: "POST" });
}
