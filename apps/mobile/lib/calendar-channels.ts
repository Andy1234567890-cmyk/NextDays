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
  portal: { label: "myNextDays", bar: "#8A5CF6", text: "#FFFFFF" },
  booking: { label: "Booking", bar: "#1B4E9B", text: "#FFFFFF" },
  airbnb: { label: "Airbnb", bar: "#E24E5B", text: "#FFFFFF" },
  vrbo: { label: "Vrbo", bar: "#2E7DB5", text: "#FFFFFF" },
};

export function channelMeta(channel: ReservationChannel): ChannelMeta {
  return CHANNELS[channel] ?? CHANNELS.direct;
}
