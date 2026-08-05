"use server";

// Airbnb-Zimmer, die nach dem Löschen bei uns DORT stehen bleiben.
//
// AIRBNB-EIGENHEIT: Airbnb hat keinen Weg, einen Raum über die Schnittstelle zu
// löschen — sechzehn Formen gemessen (05.08.2026), über Channex und direkt
// gegen api.airbnb.com; `v2/listing_rooms` kennt nur GET und POST. Wer bei uns
// ein Zimmer entfernt, hat es bei Airbnb weiterhin stehen. Statt das still zu
// verschlucken, zeigt die Oberfläche den Rest an — mit dem Weg, der wirkt.
//
// Booking.com kennt das Konzept nicht; der Booking-Connect kommt noch. Deshalb
// liegt das hier getrennt und nicht in lib/properties.ts.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AirbnbRestZimmer = {
  airbnb_room_id: string;
  /** Airbnbs Rohwert, z. B. `balcony`. */
  airbnb_art: string;
  /** Unser Slug für die Übersetzung; null bei Arten ohne Entsprechung. */
  slug: string | null;
};

export type AirbnbZimmerRest = {
  /** false = kein Airbnb-Objekt; die UI zeigt nichts an. */
  verbunden: boolean;
  /**
   * false = Airbnb war nicht lesbar. `rest` ist dann leer, WEIL wir nichts
   * wissen — nicht, weil nichts offen wäre.
   */
  stand_bekannt: boolean;
  rest: AirbnbRestZimmer[];
  /** Direktlink in die Fototour des Listings — dort geht das Löschen. */
  extranet_url?: string;
};

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

/** Welche Zimmer bei Airbnb noch stehen, obwohl wir sie nicht mehr führen. */
export async function getAirbnbZimmerRest(
  propertyId: string,
): Promise<Ergebnis<AirbnbZimmerRest>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      data: await api<AirbnbZimmerRest>(
        `/channel-manager/properties/${propertyId}/airbnb-zimmer-rest`,
        { token },
      ),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Backend nicht erreichbar.",
    };
  }
}
