// Das Statusbild einer Buchung — EINE Quelle für Beschriftung und Farbe.
//
// Vorher trugen `HostDashboard`, `HostReservations` und `ReservationDetail`
// jeweils eine eigene Kopie derselben zwei Tabellen. Das ist die Sorte
// Duplikat, die niemand als Fehler sieht: ein neuer Status (oder eine geänderte
// Farbe) wird an zwei Stellen gepflegt und an der dritten vergessen — dann heißt
// dieselbe Buchung in der Liste „Angefragt" und im Detail etwas anderes.
//
// Die Farben sind absichtlich fest und nicht aus der Palette: sie tragen eine
// BEDEUTUNG (grün = bestätigt, rot = storniert), die sich nicht mit dem
// Markenakzent ändern darf.
import type { ReservationStatus } from "@/lib/reservations";

/**
 * Der ANGEZEIGTE Status: die gespeicherten plus der abgeleitete „im Haus".
 *
 * Spiegelt `web/lib/calendar-status.ts`. „Im Haus" ist seit Migration 0091 kein
 * Datums-Schluss mehr, sondern der persistierte Zustand — eine Buchung zeigt
 * ihn erst, wenn die Rezeption wirklich eingecheckt hat. Vorher stand mobil
 * „Bestätigt", während der Gast längst im Zimmer war.
 */
export type AnzeigeStatus =
  | "pending"
  | "confirmed"
  | "in_house"
  | "completed"
  | "cancelled";

export const STATUS_LABEL: Record<AnzeigeStatus, string> = {
  pending: "Angefragt",
  confirmed: "Bestätigt",
  in_house: "Im Haus",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

export const STATUS_TONE: Record<AnzeigeStatus, { bg: string; fg: string }> = {
  confirmed: { bg: "#E6F4EA", fg: "#1E7A46" },
  completed: { bg: "#EDEDED", fg: "#5A5A5A" },
  in_house: { bg: "#E4EEF8", fg: "#1B5E9B" },
  pending: { bg: "#FCF0DA", fg: "#9A6B12" },
  cancelled: { bg: "#FBE4E4", fg: "#B02A2A" },
};

/**
 * Anzeige-Status aus den PERSISTIERTEN Feldern: storniert gewinnt immer,
 * ausgecheckt (bzw. `completed`) vor eingecheckt, sonst der gespeicherte Wert.
 *
 * Kein Datum in der Rechnung: „heute ist der Anreisetag" heißt NICHT, dass der
 * Gast da ist.
 */
export function anzeigeStatus(
  status: ReservationStatus,
  checkedInAt?: string | null,
  checkedOutAt?: string | null,
): AnzeigeStatus {
  if (status === "cancelled") return "cancelled";
  if (checkedOutAt || status === "completed") return "completed";
  if (checkedInAt) return "in_house";
  return status;
}
