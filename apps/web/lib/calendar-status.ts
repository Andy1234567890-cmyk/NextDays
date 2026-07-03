// Reservierungs-Status (OPERA/Hostaway-Stil) für die Kalender-Darstellung.
// Seit Migration 0091 gibt es ECHTEN Check-in/Check-out (checked_in_at/
// checked_out_at + Status 'completed' beim Check-out). „Eingecheckt" ist damit
// keine Datums-Ableitung mehr, sondern der persistierte Zustand — eine Buchung
// zeigt erst dann „Eingecheckt", wenn die Rezeption wirklich eingecheckt hat.
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
  /**
   * Optionale Balken-Sonderklasse. Standard-Balken (bestätigt/eingecheckt)
   * lassen das leer; „Option/vorläufig" (pending) hebt sich deutlich ab —
   * amber getönt + gestrichelter Rand, damit eine Option nicht wie eine feste
   * Buchung aussieht.
   */
  barClass?: string;
};

export const STATUS_META: Record<DisplayStatus, StatusMeta> = {
  pending: {
    label: "Option / vorläufig",
    dotBg: "bg-warning",
    icon: "ph:hourglass-medium",
    barClass: "bg-warning/25 border border-dashed border-warning text-foreground",
  },
  confirmed: { label: "Bestätigt", dotBg: "bg-success", icon: "ph:check-circle" },
  in_house: { label: "Eingecheckt", dotBg: "bg-channel-vrbo", icon: "ph:door-open" },
  completed: { label: "Ausgecheckt", dotBg: "bg-muted-foreground", icon: "ph:flag-checkered" },
  cancelled: { label: "Storniert", dotBg: "bg-destructive", icon: "ph:x-circle" },
};

// Anzeige-Status aus den PERSISTIERTEN Feldern (0091): storniert gewinnt immer;
// ausgecheckt (bzw. completed) vor eingecheckt; sonst der gespeicherte Status.
// checkIn/checkOut/todayKey bleiben in der Signatur für Aufrufer, die nur die
// Balkendaten haben — sie steuern aber KEINEN Status mehr (kein automatisches
// „Eingecheckt" nur weil die Anreise heute war).
export function displayStatus(
  status: ReservationStatus,
  _checkIn: string,
  _checkOut: string,
  _todayKey: string,
  checkedInAt?: string | null,
  checkedOutAt?: string | null,
): DisplayStatus {
  if (status === "cancelled") return "cancelled";
  if (checkedOutAt || status === "completed") return "completed";
  if (checkedInAt) return "in_house";
  return status;
}

export function reservationStatus(
  res: Reservation,
  todayKey: string,
): DisplayStatus {
  return displayStatus(
    res.status,
    res.check_in,
    res.check_out,
    todayKey,
    res.checked_in_at,
    res.checked_out_at,
  );
}
