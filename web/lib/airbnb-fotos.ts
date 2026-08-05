"use server";

// Airbnb-Foto ↔ Raum. AIRBNB-EIGENHEIT: Airbnb blendet die gesamte „Photo tour"
// für Gäste aus, wenn ein Raum kein Foto hat. Booking.com kennt das nicht — der
// Booking-Connect kommt noch, deshalb liegt das hier getrennt und nicht in
// lib/properties.ts.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AirbnbFotoZuordnung = {
  property_photo_id: string;
  airbnb_photo_id: string;
  /** null = Airbnb führt das Foto ohne Raum (Außenbild), gültiger Zustand. */
  airbnb_room_id: string | null;
};

export type AirbnbRaum = {
  id: string;
  /** Airbnbs Rohwert, z. B. `full_bathroom`. */
  airbnb_art: string;
  /** Unser Slug für die Übersetzung; null bei Arten ohne Entsprechung. */
  slug: string | null;
};

export type AirbnbFotoRaeume = {
  /** false = kein Airbnb-Objekt; die UI blendet den ganzen Bereich aus. */
  verbunden: boolean;
  /**
   * false = Airbnb war nicht lesbar. Dann ist `fotos`/`ohne_foto` leer, WEIL
   * wir nichts wissen — nicht, weil nichts zugeordnet wäre. Die UI darf daraus
   * keine Aussage ableiten (sonst meldet sie jedes Zimmer als fotolos).
   */
  stand_bekannt?: boolean;
  fotos: AirbnbFotoZuordnung[];
  raeume: AirbnbRaum[];
  /** Räume ohne Foto — der Grund, warum Airbnb die Fototour versteckt. */
  ohne_foto: AirbnbRaum[];
};

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

/** Zuordnung, Räume und die Räume ohne Foto. */
export async function getAirbnbFotoRaeume(
  propertyId: string,
): Promise<Ergebnis<AirbnbFotoRaeume>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      data: await api<AirbnbFotoRaeume>(
        `/channel-manager/properties/${propertyId}/airbnb-foto-raeume`,
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

/**
 * Ein Foto bei Airbnb einem Raum zuordnen — `null` löst es vom Raum.
 *
 * Lösen ≠ Löschen: das Foto bleibt im Listing, es hängt danach nur an keinem
 * Zimmer mehr. Ein Zimmer selbst lässt Airbnb per API nicht löschen.
 */
export async function setAirbnbFotoRaum(
  propertyId: string,
  photoId: string,
  airbnbRoomId: string | null,
): Promise<Ergebnis<{ airbnb_room_id: string | null }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      data: await api<{ airbnb_room_id: string | null }>(
        `/channel-manager/properties/${propertyId}/airbnb-foto-raeume/${photoId}`,
        { token, method: "PUT", body: { airbnb_room_id: airbnbRoomId } },
      ),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Backend nicht erreichbar.",
    };
  }
}
