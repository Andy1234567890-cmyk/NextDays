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
  // Eigene Website des Betriebs (0380). Globus-Icon statt Marke: es gibt keine
  // fremde Marke — es ist die Seite des Betriebs selbst.
  website: {
    logo: { kind: "icon", icon: "ph:globe-simple-fill" },
    barBg: "bg-channel-website",
    barFg: "text-white",
    dotBg: "bg-channel-website",
    textFg: "text-channel-website",
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
    // Kein Vrbo-Markenlogo in Iconify (`simple-icons:vrbo` existiert nicht,
    // geprüft 03.09.2026) und keine quadratische Bildmarke im Ordner — die
    // Datei `public/channels/vrbo.svg` ist eine WORTmarke mit 3,1 : 1 und
    // wird auf 1 rem zum Fleck. Also ein neutrales Symbol statt einer
    // geratenen Marke (Regel „Portal-Logos nur echt").
    //
    // Palme statt Haus: `ph:house-fill` war dasselbe Zeichen wie bei „Direkt"
    // (`ph:house-line-fill`) und unterschied sich nur in der Farbe — in der
    // Kanal-Liste der Startseite standen dadurch zwei nahezu gleiche Häuser
    // untereinander. Die Palme trägt dieselbe Aussage („Ferienunterkunft"),
    // ohne mit dem eigenen Direktkanal verwechselbar zu sein.
    logo: { kind: "icon", icon: "ph:tree-palm-fill" },
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
  contract_end: {
    // Vertragsende (0355) — auch kein Vertriebskanal. Eigenes Symbol, weil
    // „das Objekt gehört uns ab hier nicht mehr" etwas anderes ist als eine
    // Handsperre: die eine hebt man auf, die andere nur über das Enddatum.
    logo: { kind: "icon", icon: "ph:file-x-fill" },
    barBg: "bg-neutral-800",
    barFg: "text-white",
    dotBg: "bg-neutral-800",
    textFg: "text-foreground",
  },
};

// Echte Vertriebskanäle (ohne „manual") — für Legende + Kanal-Filter.
export const CHANNEL_SOURCES: AvailabilitySource[] = [
  "direct",
  // Direkt neben „direct": beide sind provisionsfreie eigene Wege, sie
  // gehören in der Legende nebeneinander und nicht zwischen die Portale.
  "website",
  "booking",
  "airbnb",
  "vrbo",
  "ota_other",
  "portal",
];

export function channelMeta(source: AvailabilitySource): ChannelMeta {
  return CHANNEL_META[source] ?? CHANNEL_META.portal;
}

/**
 * Die Kanalfarbe als CSS-Wert — für Diagramme, die eine Farbe brauchen und
 * keine Tailwind-Klasse setzen können (recharts füllt Segmente über `fill`).
 *
 * Abgeleitet aus `dotBg` statt als zwölftes Feld je Kanal: `bg-channel-airbnb`
 * und `var(--channel-airbnb)` sind derselbe Token, und zwei getrennt gepflegte
 * Listen driften. Ein neuer Kanal bekommt seine Diagrammfarbe damit
 * automatisch mit.
 *
 * Kanäle ohne `--channel-*`-Token (manual/ical/contract_end tragen
 * `bg-neutral-*`) sind keine Vertriebskanäle und tauchen in keinem Diagramm
 * auf; sie bekommen die neutrale Sammelfarbe statt einer geratenen.
 */
export function channelChartColor(source: AvailabilitySource): string {
  const token = channelMeta(source).dotBg;
  return token.startsWith("bg-channel-")
    ? `var(--${token.slice("bg-".length)})`
    : "var(--channel-ota-other)";
}
