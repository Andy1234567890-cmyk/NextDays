// Buchungskanäle → Balkenfarbe/Label für den Kalender (wie Web
// lib/calendar-channels.ts). Feste Markenfarben der Kanäle (Airbnb-Rot,
// Booking-Blau …) — das sind Kanal-Identitäten, KEINE Währungs-/Fantasiewerte
// (Wurzel 4 betrifft Geld, nicht Markenfarben). Im UI nie „Channex" nennen
// (Portale-Sammelbegriff).
import type { ReservationChannel } from "@/lib/reservations";

export type ChannelMeta = {
  label: string;
  bar: string; // Balken-Hintergrund
  text: string; // Balken-Textfarbe
};

const CHANNELS: Record<ReservationChannel, ChannelMeta> = {
  direct: { label: "Direkt", bar: "#2F6F4F", text: "#FFFFFF" },
  // Eigene Website des Betriebs (0380) — provisionsfrei wie „Direkt", aber
  // getrennt sichtbar. Bewusst ein anderer Ton als `direct` (dort Waldgrün),
  // sonst sind die beiden im Balken nicht auseinanderzuhalten.
  website: { label: "Website", bar: "#0F766E", text: "#FFFFFF" },
  portal: { label: "myBestDays", bar: "#8A5CF6", text: "#FFFFFF" },
  booking: { label: "Booking", bar: "#1B4E9B", text: "#FFFFFF" },
  airbnb: { label: "Airbnb", bar: "#E24E5B", text: "#FFFFFF" },
  vrbo: { label: "Vrbo", bar: "#2E7DB5", text: "#FFFFFF" },
  // Sammelkanal fremder Portale ohne eigenen Wert (Expedia, Agoda …) — keine
  // Marke, also neutrales Grau und kein geratenes Logo. Wo ein `ota_name`
  // vorliegt, zeigt die UI den Klarnamen statt dieses Sammellabels.
  ota_other: { label: "Anderes Portal", bar: "#52525B", text: "#FFFFFF" },
};

/**
 * Alle Kanäle in Anzeige-Reihenfolge — für die Legende des Kalenders.
 *
 * Bewusst hier und nicht im Screen: die Legende trug ihre fünf Kanäle samt
 * Hex-Farben als eigene Liste. Sie kannte damit `website` und „Anderes Portal"
 * nicht, und eine Farbänderung hätte an zwei Stellen gepflegt werden müssen —
 * ein Balken ohne Legendeneintrag ist genau der stille Fehler, den die
 * Kanal-Kette (CLAUDE.md: Enum → Meta → UI) verhindern soll.
 */
export const KANAELE = Object.keys(CHANNELS) as ReservationChannel[];

export function channelMeta(channel: ReservationChannel): ChannelMeta {
  return CHANNELS[channel] ?? CHANNELS.direct;
}
