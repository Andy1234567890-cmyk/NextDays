// Echte Portal-Logos für die Kanal-Herkunft einer Buchung.
//
// Vorgabe (wie im Web, web/lib/channel-logos.ts): NUR echte, offiziell
// beschaffte Markenlogos — kein generisches Ersatz-Icon und kein selbst
// gezeichnetes Logo. Die PNGs sind aus denselben Original-SVGs erzeugt, die das
// Web-Dashboard ausliefert (web/public/channels/*.svg), rasterisiert weil bare
// React Native ohne zusätzlichen Transformer keine SVG-Dateien lädt.
//
// Kanäle OHNE Logo geben `null` zurück — die UI zeigt dann nur den Namen. Das
// ist Absicht: „Direkt" ist keine Marke, und für den eigenen Marktplatz steht
// das Marken-Logo bereits im Theme (theme/marke.ts).
import type { ImageSourcePropType } from "react-native";

import type { ReservationChannel } from "@/lib/reservations";

const LOGOS: Partial<Record<ReservationChannel, ImageSourcePropType>> = {
  booking: require("@/assets/portale/booking.png"),
  airbnb: require("@/assets/portale/airbnb.png"),
  vrbo: require("@/assets/portale/vrbo.png"),
};

/** Logo des Kanals — `null`, wenn es für ihn bewusst keines gibt. */
export function portalLogo(channel: ReservationChannel): ImageSourcePropType | null {
  return LOGOS[channel] ?? null;
}

// Portal-Codes, deren technischer Name nicht der Markenname ist. Spiegelt
// `CHANNEL_LABEL` in web/lib/channel-logos.ts — neue Codes dort UND hier
// eintragen. Alle anderen Codes SIND der Markenname („Agoda", „Expedia") und
// werden unverändert gezeigt; hier wird nichts geraten und nichts übersetzt.
const PORTAL_LABEL: Record<string, string> = {
  bookingcom: "Booking.com",
  airbnb: "Airbnb",
  googlehotelari: "Google",
  ctrip: "Trip.com",
  despegarv2: "Despegar",
  openchannel: "Testkanal",
};

/**
 * Anzeigename für einen `ota_name` aus einer Buchung.
 *
 * `ota_name` ist der Kanalcode des Aggregators, nicht der Klarname: Channex
 * schreibt „BookingCom" ohne Punkt, und genau so stand es in der App. Der
 * Abgleich ist schreibweisen-tolerant, weil der Wert aus fremden Daten kommt.
 * Unbekannte Namen bleiben unverändert — besser der echte Code als ein
 * erfundener Klarname.
 */
export function portalLabel(name: string | null | undefined): string {
  if (!name) return "";
  return PORTAL_LABEL[name.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? name;
}
