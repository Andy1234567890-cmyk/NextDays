// Zentrales Mapping Kanal-/Plattform-Herkunft → Label, Logo, Farbakzent.
// EINE Wahrheit für die Kanal-Darstellung im Multikalender (Balken-Badge,
// Legende, Filter). Quelle ist der AvailabilitySource-/Reservation-Channel-Wert
// aus dem Backend (direct/portal/booking/airbnb/vrbo/ota_other/manual). Farben kommen aus
// den --channel-*-Tokens (globals.css), nicht aus bg-[#…]-Arbitraries.
import type { AvailabilitySource } from "@/lib/calendar";

export type ChannelMeta = {
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

// `manual` und `ical` sind keine echten Plattformen, sondern gesperrte Nächte
// (von Hand bzw. aus einem abonnierten Fremdkalender) — sie erscheinen nicht
// als „Kanal", brauchen aber Farbe und Label.
// Reihenfolge = Anzeigereihenfolge in Legende/Filter.
// Logos: echte Markenformen. Airbnb gibt es als farbiges Iconify-Logo
// (logos:airbnb); Booking/Expedia/Vrbo nur als monochrome simple-icons —
// die werden auf dem (farbigen) Balken in Weiß und als Legenden-Punkt in der
// Markenfarbe gerendert, sodass die Marke klar erkennbar bleibt.
export const CHANNEL_META: Record<AvailabilitySource, ChannelMeta> = {
  direct: {
    logo: { kind: "icon", icon: "ph:house-line-fill" },
    barBg: "bg-channel-direct",
    barFg: "text-white",
    dotBg: "bg-channel-direct",
    textFg: "text-channel-direct",
  },
  booking: {
    logo: { kind: "icon", icon: "simple-icons:bookingdotcom" },
    barBg: "bg-channel-booking",
    barFg: "text-white",
    dotBg: "bg-channel-booking",
    textFg: "text-channel-booking",
  },
  airbnb: {
    logo: { kind: "icon", icon: "simple-icons:airbnb" },
    barBg: "bg-channel-airbnb",
    barFg: "text-white",
    dotBg: "bg-channel-airbnb",
    textFg: "text-channel-airbnb",
  },
  vrbo: {
    // Kein Vrbo-Markenlogo in Iconify → klares Ferienhaus-Symbol als Platzhalter.
    logo: { kind: "icon", icon: "ph:house-fill" },
    barBg: "bg-channel-vrbo",
    barFg: "text-white",
    dotBg: "bg-channel-vrbo",
    textFg: "text-channel-vrbo",
  },
  portal: {
    // Eigener Marktplatz — heißt seit der Umbenennung myBestDays (wie in mobile).
    logo: { kind: "icon", icon: "ph:globe-hemisphere-west-fill" },
    barBg: "bg-channel-portal",
    barFg: "text-white",
    dotBg: "bg-channel-portal",
    textFg: "text-channel-portal",
  },
  ota_other: {
    // Sammelkanal (Expedia, Agoda, unbekannte Namensvarianten) — keine Marke,
    // also KEIN Markenlogo raten (Regel „Portal-Logos nur echt"): neutrales
    // Portal-Symbol in neutralem Grau. Wo eine Reservierung dranhängt, zeigt
    // die UI ohnehin den echten `ota_name` statt des Sammellabels.
    logo: { kind: "icon", icon: "ph:globe-hemisphere-east-fill" },
    barBg: "bg-channel-ota-other",
    barFg: "text-white",
    dotBg: "bg-channel-ota-other",
    textFg: "text-channel-ota-other",
  },
  manual: {
    logo: { kind: "icon", icon: "ph:lock-simple-fill" },
    barBg: "bg-neutral-700",
    barFg: "text-white",
    dotBg: "bg-neutral-700",
    textFg: "text-foreground",
  },
  ical: {
    // Sperre aus einem abonnierten Fremdkalender — wie `manual` kein
    // Vertriebskanal, deshalb neutral und nicht in CHANNEL_SOURCES.
    logo: { kind: "icon", icon: "ph:calendar-x-fill" },
    barBg: "bg-neutral-600",
    barFg: "text-white",
    dotBg: "bg-neutral-600",
    textFg: "text-foreground",
  },
};

// Echte Vertriebskanäle (ohne „manual") — für Legende + Kanal-Filter.
export const CHANNEL_SOURCES: AvailabilitySource[] = [
  "direct",
  "booking",
  "airbnb",
  "vrbo",
  "ota_other",
  "portal",
];

export function channelMeta(source: AvailabilitySource): ChannelMeta {
  return CHANNEL_META[source] ?? CHANNEL_META.portal;
}
