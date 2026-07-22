// Zentrales Mapping Kanal-/Plattform-Herkunft → Label, Logo, Farbakzent.
// EINE Wahrheit für die Kanal-Darstellung im Multikalender (Balken-Badge,
// Legende, Filter). Quelle ist der AvailabilitySource-/Reservation-Channel-Wert
// aus dem Backend (direct/portal/booking/airbnb/vrbo/manual). Farben kommen aus
// den --channel-*-Tokens (globals.css), nicht aus bg-[#…]-Arbitraries.
import type { AvailabilitySource } from "@/lib/calendar";

export type ChannelMeta = {
  /** Menschliches Label (white-label: echter Plattformname, kein interner Code). */
  label: string;
  /** Iconify-Icon ODER lokales SVG (kind unterscheidet das Rendering). */
  logo: { kind: "icon"; icon: string } | { kind: "img"; src: string };
  /** Hintergrund-Utility des Balkens (Token-basiert). */
  barBg: string;
  /** Text-/Icon-Farbe auf dem Balken (Kontrast zum barBg). */
  barFg: string;
  /** Akzent-Punkt in der Legende. */
  dotBg: string;
  /** Textfarbe in Kanalfarbe (z. B. Quelle-Link „#booking.com" in der Buchungsliste). */
  textFg: string;
};

// `manual` ist keine echte Plattform, sondern eine intern gesperrte/gepflegte
// Quelle — sie erscheint nicht als „Kanal", taucht aber bei Bedarf als Fallback
// auf. Reihenfolge = Anzeigereihenfolge in Legende/Filter.
// Logos: echte Markenformen. Airbnb gibt es als farbiges Iconify-Logo
// (logos:airbnb); Booking/Expedia/Vrbo nur als monochrome simple-icons —
// die werden auf dem (farbigen) Balken in Weiß und als Legenden-Punkt in der
// Markenfarbe gerendert, sodass die Marke klar erkennbar bleibt.
export const CHANNEL_META: Record<AvailabilitySource, ChannelMeta> = {
  direct: {
    label: "Direkt",
    logo: { kind: "icon", icon: "ph:house-line-fill" },
    barBg: "bg-channel-direct",
    barFg: "text-white",
    dotBg: "bg-channel-direct",
    textFg: "text-channel-direct",
  },
  booking: {
    label: "Booking.com",
    logo: { kind: "icon", icon: "simple-icons:bookingdotcom" },
    barBg: "bg-channel-booking",
    barFg: "text-white",
    dotBg: "bg-channel-booking",
    textFg: "text-channel-booking",
  },
  airbnb: {
    label: "Airbnb",
    logo: { kind: "icon", icon: "simple-icons:airbnb" },
    barBg: "bg-channel-airbnb",
    barFg: "text-white",
    dotBg: "bg-channel-airbnb",
    textFg: "text-channel-airbnb",
  },
  vrbo: {
    label: "Vrbo",
    // Kein Vrbo-Markenlogo in Iconify → klares Ferienhaus-Symbol als Platzhalter.
    logo: { kind: "icon", icon: "ph:house-fill" },
    barBg: "bg-channel-vrbo",
    barFg: "text-white",
    dotBg: "bg-channel-vrbo",
    textFg: "text-channel-vrbo",
  },
  portal: {
    label: "Portal",
    logo: { kind: "icon", icon: "ph:globe-hemisphere-west-fill" },
    barBg: "bg-channel-portal",
    barFg: "text-white",
    dotBg: "bg-channel-portal",
    textFg: "text-channel-portal",
  },
  manual: {
    label: "Manuell",
    logo: { kind: "icon", icon: "ph:lock-simple-fill" },
    barBg: "bg-neutral-700",
    barFg: "text-white",
    dotBg: "bg-neutral-700",
    textFg: "text-foreground",
  },
};

// Echte Vertriebskanäle (ohne „manual") — für Legende + Kanal-Filter.
export const CHANNEL_SOURCES: AvailabilitySource[] = [
  "direct",
  "booking",
  "airbnb",
  "vrbo",
  "portal",
];

export function channelMeta(source: AvailabilitySource): ChannelMeta {
  return CHANNEL_META[source] ?? CHANNEL_META.portal;
}
