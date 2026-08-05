"use server";

// Gebühren, die bei Airbnb hinterlegt sind — lesen und übernehmen.
//
// WARUM EIGENER WEG: Airbnb hat die Preis-Einstellungen des Listings, die wir
// beim Onboarding NICHT bekommen (über Channex kommen nur acht Felder). Der
// Betrieb müsste seine Reinigungs-, Resort- und Haustiergebühr abtippen,
// obwohl sie schon existieren.
//
// Die Gegenrichtung (unsere Gebühren → Portale) läuft NICHT hier, sondern über
// den Abgaben-Sync für alle Portale gemeinsam (tax_sync/ota_abgaben).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Eine Gebühr in unserer Form — dasselbe Schema wie im Preis-Blob. */
export type AirbnbGebuehr = {
  id: string;
  name: string;
  names?: Record<string, string>;
  feeType: string;
  mode: "amount" | "percent";
  basis: string;
  optional: boolean;
  /** Trägt BEIDES: den Betrag oder — bei `mode: "percent"` — den Prozentsatz. */
  amount: number;
};

export type AirbnbGebuehrenVergleich = {
  /** false = kein Airbnb-Objekt oder kein Mapping. */
  verbunden: boolean;
  /**
   * false = Airbnbs Stand war nicht lesbar. Die Listen sind dann leer, WEIL
   * wir nichts wissen — nicht, weil nichts da wäre.
   */
  stand_bekannt: boolean;
  waehrung?: string | null;
  airbnb: AirbnbGebuehr[];
  /** Bei Airbnb hinterlegt, bei uns nicht — das Angebot zum Übernehmen. */
  nur_airbnb: AirbnbGebuehr[];
  /** Nur bei uns: neu angelegt oder eine Art, die Airbnb nicht kennt. */
  nur_wir: AirbnbGebuehr[];
  gleich: AirbnbGebuehr[];
};

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

/** Airbnbs Gebühren gegen unsere stellen. */
export async function getAirbnbGebuehren(
  propertyId: string,
): Promise<Ergebnis<AirbnbGebuehrenVergleich>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      data: await api<AirbnbGebuehrenVergleich>(
        `/channel-manager/properties/${propertyId}/airbnb-gebuehren`,
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
 * Die fehlenden Gebühren von Airbnb übernehmen.
 *
 * Legt nur an, was fehlt — bestehende Gebühren bleiben unangetastet, es wird
 * nichts gelöscht und nichts überschrieben.
 */
export async function airbnbGebuehrenUebernehmen(
  propertyId: string,
): Promise<Ergebnis<{ uebernommen: number; fees: AirbnbGebuehr[] }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      // `fees` ist die VOLLSTÄNDIGE neue Liste, wie der Server sie führt —
      // nicht nur die übernommenen. Die Seite setzt sie direkt, statt das
      // Objekt neu zu laden.
      data: await api<{ uebernommen: number; fees: AirbnbGebuehr[] }>(
        `/channel-manager/properties/${propertyId}/airbnb-gebuehren/uebernehmen`,
        { token, method: "POST" },
      ),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Backend nicht erreichbar.",
    };
  }
}
