// Aufenthalt/Gastmappe einer eigenen Buchung (/api/v1/guest-stay): Check-in-
// Infos, WLAN, Hausordnung, Türcode und Self-Check-in. Contract:
// guest_stay/schemas.py. Der Türcode kommt NUR, wenn die Freigaberegeln des
// Servers erfüllt sind — fehlt er, liefert das Backend den Grund mit
// (`door_code_hidden_reason`); die App erfindet nichts.
import { guestCall, type Result } from "@/lib/guestApi";

// Mehrsprachiger Textblock ({"de": "…", "en": "…"}) oder null.
export type LocalizedText = Record<string, string> | null;

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
  property_id: string;
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

export async function getStay(reservationId: string): Promise<Result<Stay>> {
  return guestCall(`/guest-stay/${encodeURIComponent(reservationId)}`);
}

export async function selfCheckIn(
  reservationId: string,
): Promise<
  Result<{ reservation_id: string; checked_in_at: string; already_checked_in: boolean }>
> {
  return guestCall(`/guest-stay/${encodeURIComponent(reservationId)}/check-in`, {
    method: "POST",
  });
}

/**
 * Text eines mehrsprachigen Blocks in der bevorzugten Sprache. Kein
 * Fantasie-Fallback: existiert weder die Sprache noch „de"/„en", ist das
 * Ergebnis null und der Block wird gar nicht gerendert.
 */
export function localized(text: LocalizedText, locale = "de"): string | null {
  if (!text) return null;
  const kandidaten = [locale, locale.split("-")[0], "de", "en"];
  for (const k of kandidaten) {
    const wert = k ? text[k] : undefined;
    if (typeof wert === "string" && wert.trim()) return wert;
  }
  // Sonst der erste nicht-leere Eintrag (der Vermieter hat nur eine Sprache
  // gepflegt) — immer noch ECHTER Inhalt, kein erfundener.
  for (const wert of Object.values(text)) {
    if (typeof wert === "string" && wert.trim()) return wert;
  }
  return null;
}
