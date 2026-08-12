// Serverseitiger Angebots-Abruf für die Checkout-Seite.
//
// Die Checkout-Seite ist eine Server-Component: sie MUSS den verbindlichen Preis
// (samt Zahlungsplan, Storno und Kaution) schon beim Rendern kennen — sonst
// blitzte erst eine leere Zusammenfassung auf und der Gast sähe Beträge, die
// nachträglich springen. lib/buchung.ts bleibt der Client-Pfad (Widget); hier
// wird FastAPI direkt gerufen (siehe lib/backend-basis.ts).
import { backendBasis } from "./backend-basis";
import type { Angebot } from "./buchung";

const FETCH_TIMEOUT_MS = 8000;

export type AngebotsAnfrage = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  promoCode?: string;
};

/** Verbindliches Angebot des Servers — null, wenn es keins gibt (unbekanntes
 *  Objekt, ungültiger Zeitraum, Backend nicht erreichbar). Kein Ersatzpreis:
 *  ohne Angebot zeigt der Checkout seinen Fehlerzustand statt einer Zahl, die
 *  niemand berechnet hat (Wurzel 4). */
export async function ladeAngebotServer(
  anfrage: AngebotsAnfrage,
): Promise<Angebot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendBasis()}/api/v1/booking-engine/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        property_id: anfrage.propertyId,
        check_in: anfrage.checkIn,
        check_out: anfrage.checkOut,
        guests: anfrage.guests,
        pets: anfrage.pets,
        promo_code: anfrage.promoCode,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Angebot;
  } catch (fehler) {
    console.error("ladeAngebotServer fehlgeschlagen:", fehler);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
