// Kanalfarben — dieselben Werte wie das Web-Dashboard (web/app/globals.css,
// `--channel-*`). Die Chips im Kalender tragen die KANALFARBE, damit der
// Eigentümer auf einen Blick sieht, woher eine Buchung kam — und damit App und
// Web dieselbe Sprache sprechen: ein Booking-Chip ist hier so blau wie dort.
//
// APP-EIGEN, bewusst nicht in theme/tokens.ts: jene Datei ist CI-geprüfte
// Schwesterdatei (byte-identisch zu mobile-bestdays), und die Gast-App kennt
// keine Kanäle. Neue Kanalwerte kommen aus dem Backend-Enum und gehören an
// alle Stellen der Kette (`node scripts/i18n/kanal-enums-pruefen.mjs`).
import type { ReservationChannel } from "@/lib/kanaele";

export const KANAL_FARBE: Record<ReservationChannel, string> = {
  booking: "#003580", // Booking.com-Blau
  airbnb: "#ff5a5f", // Airbnb-Rot
  vrbo: "#1668e3", // Vrbo-Blau
  portal: "#71717a", // eigener Marktplatz myBestDays
  // Eigene Wege des Betriebs (Direkt, eigene Website): myNextDays-Schwarz.
  // Provisionsfrei, kein Portal dazwischen — beide tragen denselben Ton.
  direct: "#0a0a0a",
  website: "#0a0a0a",
  // Bewusst dunkler als `portal`, sonst wären der eigene Marktplatz und ein
  // fremdes Sammelportal nicht zu unterscheiden.
  ota_other: "#52525b",
};

/** Farbe des Kanals; ohne Kanal der Sammelton für „irgendein Portal". */
export function kanalFarbe(kanal: ReservationChannel | null): string {
  return kanal ? KANAL_FARBE[kanal] : KANAL_FARBE.ota_other;
}
