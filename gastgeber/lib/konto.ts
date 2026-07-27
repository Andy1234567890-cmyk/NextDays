// Data-Layer Konto (Server Component). GET /auth/account liefert die echten
// Konto-/Profil-/Sicherheitsdaten (kein Erfinden, Wurzel 4). Maskierte/fehlende
// Felder werden im UI als „—"/„Nicht angegeben" gerendert.
import { api, ApiError } from "./api-server";

export interface Account {
  user_id: string;
  email: string | null;
  full_name: string | null;
  has_password: boolean;
  totp_enabled: boolean;
  role: string | null;
  phone: string | null;
  additional_phone: string | null;
  hide_phones: boolean;
  preferred_language: string | null;
  /** ISO-4217 Anzeigewährung des Nutzers — NICHT die Objektwährung. */
  preferred_currency: string | null;
  /** IANA-Zeitzone, z. B. "Europe/Berlin". */
  preferred_timezone: string | null;
  spoken_languages: string[];
  website: string | null;
  description: string | null;
  avatar_url: string | null;
  permissions: string[];
  tenant_country: string | null;
  // Personengebundene Felder (Airbnb „Persönliche Informationen").
  preferred_first_name: string | null;
  residential_street: string | null;
  residential_postal_code: string | null;
  residential_city: string | null;
  residential_country: string | null;
  mailing_street: string | null;
  mailing_postal_code: string | null;
  mailing_city: string | null;
  mailing_country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  // Identitätsprüfung (Stripe Identity) — echter Status.
  identity_status: "unverified" | "processing" | "requires_input" | "verified";
  identity_verified_at: string | null;
  // Telefonnummer-Verifizierung (SMS-OTP) — Zeitpunkt oder null.
  phone_verified_at: string | null;
}

/** Das eigene Konto (oder null, wenn nicht eingeloggt / kein Zugriff). */
export async function getAccount(): Promise<Account | null> {
  try {
    return await api<Account>("/auth/account");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
