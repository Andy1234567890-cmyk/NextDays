"use server";

// Schreib-Actions Konto (Server Actions über den Host-Cookie-DAL). Echte
// FastAPI-Endpunkte (apps/api/.../auth/router.py). Jede Aktion gibt bei Fehler
// die Backend-Meldung zurück (sprechend, kein stiller Fehlschlag — Wurzel 5).
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Account } from "./konto";

type Result = { ok: true; data: Account } | { ok: false; error: string };

async function patch(path: string, body: unknown): Promise<Result> {
  try {
    const data = await api<Account>(path, { method: "PATCH", body });
    revalidatePath("/konto");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

/** Anzeigename ändern (PATCH /auth/account/name). */
export async function updateName(fullName: string): Promise<Result> {
  return patch("/auth/account/name", { full_name: fullName });
}

/** E-Mail ändern — Backend erzwingt Doppel-Opt-in an die NEUE Adresse
 *  (kein Auto-Confirm, Wurzel 7). PATCH /auth/account/email. */
export async function updateEmail(newEmail: string): Promise<Result> {
  return patch("/auth/account/email", { new_email: newEmail });
}

/** Passwort ändern — verlangt current_password (Re-Auth, Wurzel 7).
 *  PATCH /auth/account/password. */
export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Result> {
  return patch("/auth/account/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/** Profil-/Kontaktdaten. Nur gesetzte Felder werden geändert.
 *  PATCH /auth/account/profile. */
export async function updateProfile(fields: {
  phone?: string;
  additional_phone?: string;
  hide_phones?: boolean;
  preferred_language?: string;
  spoken_languages?: string[];
  website?: string;
  description?: string;
  preferred_first_name?: string;
  residential_street?: string;
  residential_postal_code?: string;
  residential_city?: string;
  residential_country?: string;
  mailing_street?: string;
  mailing_postal_code?: string;
  mailing_city?: string;
  mailing_country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}): Promise<Result> {
  return patch("/auth/account/profile", fields);
}

// --- Telefonnummer-Verifizierung (SMS-OTP) -------------------------------

type Ok = { ok: true } | { ok: false; error: string };

/** SMS-Code an die Nummer senden (Airbnb-„Confirm account"). Idempotent +
 *  rate-limited im Backend. */
export async function sendPhoneCode(phone: string): Promise<Ok> {
  try {
    await api("/auth/phone/send-code", { method: "POST", body: { phone } });
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "SMS-Versand fehlgeschlagen.",
    };
  }
}

/** Code prüfen → Nummer wird als verifiziert gesetzt (phone_verified_at). */
export async function verifyPhoneCode(
  phone: string,
  code: string,
): Promise<Ok> {
  try {
    await api("/auth/phone/verify", { method: "POST", body: { phone, code } });
    revalidatePath("/konto");
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Code ungültig.",
    };
  }
}

// --- 2FA / TOTP ----------------------------------------------------------

export interface TotpEnroll {
  secret: string;
  otpauth_uri: string;
  qr_data_url: string;
}

/** 2FA-Einrichtung starten: Secret + fertiger QR-Code (data-URL). Noch NICHT
 *  aktiv — erst nach totpVerify mit einem gültigen Code. */
export async function totpEnroll(): Promise<
  { ok: true; data: TotpEnroll } | { ok: false; error: string }
> {
  try {
    const data = await api<TotpEnroll>("/auth/totp/enroll", { method: "POST" });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "2FA-Start fehlgeschlagen.",
    };
  }
}

/** 2FA bestätigen: Code aus der App prüfen → aktiviert 2FA und gibt einmalig
 *  die Recovery-Codes zurück. */
export async function totpVerify(
  code: string,
): Promise<
  { ok: true; recoveryCodes: string[] } | { ok: false; error: string }
> {
  try {
    const data = await api<{ totp_enabled: boolean; recovery_codes: string[] }>(
      "/auth/totp/verify",
      { method: "POST", body: { code } },
    );
    return { ok: true, recoveryCodes: data.recovery_codes };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Code ungültig.",
    };
  }
}

/** 2FA deaktivieren — verlangt einen aktuellen Code (Re-Auth, Wurzel 7).
 *  POST (nicht PATCH). */
export async function totpDisable(code: string): Promise<Result> {
  try {
    const data = await api<Account>("/auth/totp/disable", {
      method: "POST",
      body: { code },
    });
    revalidatePath("/konto");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Deaktivieren fehlgeschlagen.",
    };
  }
}

/** Startet die Ausweis-/Selfie-Verifizierung (Stripe Identity). Gibt die
 *  Hosted-URL zurück, auf die das Frontend weiterleitet. return_url = eigene
 *  „wird geprüft"-Seite (kein Backend-Hardcode, Wurzel 4). */
export async function startIdentityVerification(
  returnUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const data = await api<{ url: string }>(
      "/payments/identity/verification-session",
      { method: "POST", body: { return_url: returnUrl } },
    );
    return { ok: true, url: data.url };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Verifizierung fehlgeschlagen.",
    };
  }
}

// --- Geräteverlauf / Login-Geräte ------------------------------------------

/** Ein Gerät im Geräteverlauf (aus /login-devices — echte IP + Gerät + Ort).
 *  ip/country/city können null sein (unbekannt) → UI rendert „—". Die
 *  Aufbereitung von user_agent zu „Chrome · macOS" passiert im UI. */
export type GeraetSitzung = {
  id: string;
  user_agent: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  is_current: boolean;
};

/** Geräte laden (GET /login-devices). */
export async function ladeSitzungen(): Promise<
  { ok: true; sitzungen: GeraetSitzung[] } | { ok: false; error: string }
> {
  try {
    const sitzungen = await api<GeraetSitzung[]>("/login-devices");
    return { ok: true, sitzungen };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError ? exc.message : "Geräte konnten nicht geladen werden.",
    };
  }
}

/** Ein Gerät abmelden (DELETE /login-devices/{id}). */
export async function widerrufeSitzung(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api<void>(`/login-devices/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Abmelden fehlgeschlagen.",
    };
  }
}

/** Auf allen anderen Geräten abmelden (DELETE /login-devices/others). */
export async function widerrufeAndereSitzungen(): Promise<
  { ok: true; revoked: number } | { ok: false; error: string }
> {
  try {
    const data = await api<{ revoked: number }>("/login-devices/others", {
      method: "DELETE",
    });
    return { ok: true, revoked: data.revoked };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Abmelden fehlgeschlagen.",
    };
  }
}
