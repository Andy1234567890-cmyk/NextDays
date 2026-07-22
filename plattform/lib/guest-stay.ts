// Aufenthalts-/Gastmodul (/api/v1/guest-stay). Check-in-Infos, WLAN, Hausordnung,
// Türcode und Self-Check-in einer Reservierung des eingeloggten Gastes.
import { guestCall, type Result } from "./guest-api";

// Zweisprachiger Textblock: de bevorzugt, en als Fallback (nie erfinden).
export type LocalizedText = { de: string | null; en: string | null } | null;

export type StayMessaging = {
  check_in: LocalizedText;
  check_out: LocalizedText;
  directions: LocalizedText;
  door_instructions: LocalizedText;
  rules: LocalizedText;
  wifi: LocalizedText;
  local_guide: LocalizedText;
  emergency: LocalizedText;
};

export type Stay = {
  reservation_id: string;
  property_title: string;
  property_address: string | null;
  currency: string | null;
  check_in: string;
  check_out: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  payment_status: string;
  self_checkin: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  maintenance_phone: string | null;
  header_image_path: string | null;
  messaging: StayMessaging;
  door_code: string | null;
  door_code_hidden_reason: string | null;
};

export async function ladeAufenthalt(
  reservationId: string,
): Promise<Result<Stay>> {
  return guestCall(`guest-stay/${encodeURIComponent(reservationId)}`);
}

export async function selfCheckIn(
  reservationId: string,
): Promise<Result<{ reservation_id: string; checked_in_at: string; already_checked_in: boolean }>> {
  return guestCall(
    `guest-stay/${encodeURIComponent(reservationId)}/check-in`,
    { method: "POST" },
  );
}
