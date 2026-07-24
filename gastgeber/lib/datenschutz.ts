// Data-Layer Datenschutz-Einstellungen (Server Component) über den DAL.
// GET /privacy-settings liefert die persistierten Präferenzen des Kontos; fehlt
// die Zeile, gibt das Backend die Airbnb-Defaults zurück (kein Erfinden hier).
import { api, ApiError } from "./api-server";

export interface PrivacySettings {
  message_read_receipts: boolean;
  listings_search_engine_indexing: boolean;
  review_show_home_city: boolean;
  review_show_trip_type: boolean;
  review_show_length_of_stay: boolean;
  review_show_booked_services: boolean;
  ai_features_contribution: boolean;
}

/** Nur die booleschen Präferenz-Schlüssel — Basis für Toggle-Updates. */
export type PrivacyKey = keyof PrivacySettings;

/** Datenschutz-Präferenzen des eingeloggten Kontos (oder null bei fehlendem
 *  Zugriff — das UI zeigt dann eine Fehlermeldung, kein Fantasie-Default). */
export async function getPrivacySettings(): Promise<PrivacySettings | null> {
  try {
    return await api<PrivacySettings>("/privacy-settings");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Ein blockierter Plattform-Gast (Airbnb „Blockierte Personen"). name/email
 *  können null sein → UI rendert „—". */
export interface BlockedGuest {
  id: string;
  portal_guest_id: string;
  name: string | null;
  email: string | null;
  reason: string | null;
  created_at: string | null;
}

/** Blockierte Gäste des Betriebs (oder null bei fehlendem Zugriff/Rolle). */
export async function getBlockedGuests(): Promise<BlockedGuest[] | null> {
  try {
    return await api<BlockedGuest[]>("/guest-blocks");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
