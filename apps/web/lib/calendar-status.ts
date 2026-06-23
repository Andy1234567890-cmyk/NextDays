// Reservierungs-Status (OPERA/Hostaway-Stil) für die Kalender-Darstellung.
// Das Backend kennt vier persistierte Status (pending/confirmed/cancelled/
// completed). „In-house" (eingecheckt) wird datengetrieben abgeleitet — eine
// bestätigte Buchung, deren Zeitraum HEUTE läuft —, ohne ein DB-Enum zu ändern.
import type { Reservation, ReservationStatus } from "@/lib/reservations";

// Anzeige-Status: die persistierten plus der abgeleitete „in_house".
export type DisplayStatus =
  | "pending"
  | "confirmed"
  | "in_house"
  | "completed"
  | "cancelled";

export type StatusMeta = {
  label: string;
  /** Kleiner Status-Punkt auf dem Balken (Token-basierte Farbe). */
  dotBg: string;
  /** Iconify-Icon für Tooltip/Legende. */
  icon: string;
};

export const STATUS_META: Record<DisplayStatus, StatusMeta> = {
  pending: { label: "Option / vorläufig", dotBg: "bg-warning", icon: "ph:hourglass-medium" },
  confirmed: { label: "Bestätigt", dotBg: "bg-success", icon: "ph:check-circle" },
  in_house: { label: "Eingecheckt", dotBg: "bg-channel-vrbo", icon: "ph:door-open" },
  completed: { label: "Ausgecheckt", dotBg: "bg-muted-foreground", icon: "ph:flag-checkered" },
  cancelled: { label: "Storniert", dotBg: "bg-destructive", icon: "ph:x-circle" },
};

// Anzeige-Status ableiten: bestätigte Buchung, deren Zeitraum heute läuft,
// gilt als „eingecheckt" (in-house). `todayKey` = YYYY-MM-DD von heute.
export function displayStatus(
  status: ReservationStatus,
  checkIn: string,
  checkOut: string,
  todayKey: string,
): DisplayStatus {
  if (status === "confirmed" && checkIn <= todayKey && todayKey < checkOut) {
    return "in_house";
  }
  return status;
}

export function reservationStatus(
  res: Reservation,
  todayKey: string,
): DisplayStatus {
  return displayStatus(res.status, res.check_in, res.check_out, todayKey);
}
