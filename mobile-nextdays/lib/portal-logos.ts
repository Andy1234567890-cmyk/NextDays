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
