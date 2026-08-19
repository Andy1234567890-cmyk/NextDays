// Eigenes Konto und Sicherheit — gegen den FastAPI-auth-Slice.
//
// WAS HIER LÄUFT UND WAS NICHT:
//   * Konto-Daten (Name, E-Mail, Passwort, Telefon, Sprache) und der
//     2FA-ZUSTAND laufen über unsere API.
//   * Das EINRICHTEN eines Faktors (TOTP) läuft GoTrue-nativ über
//     `supabase-js` (0341, `lib/mfa.ts`) — die FastAPI spiegelt es bewusst
//     nicht (`/auth/totp/enroll` antwortet 410 GONE). Was der Anmeldedienst
//     selbst kann, wird nicht nachgebaut.
import { call, type Result } from "@/lib/api";

export type Konto = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  /** false bei reinen OAuth-Konten — dann gibt es kein Passwort zu ändern. */
  has_password: boolean;
  totp_enabled: boolean;
  role: string | null;
  phone: string | null;
  additional_phone: string | null;
  preferred_language: string | null;
  preferred_currency: string | null;
  preferred_timezone: string | null;
  website: string | null;
  description: string | null;
  avatar_url: string | null;
  permissions: string[];
};

export async function getKonto(): Promise<Result<Konto>> {
  return call("/auth/account");
}

export async function setzeName(fullName: string): Promise<Result<Konto>> {
  return call("/auth/account/name", {
    method: "PATCH",
    body: { full_name: fullName },
  });
}

/**
 * E-Mail ändern. Verlangt das aktuelle Passwort (Re-Auth, Wurzel 7) und schickt
 * ein Doppel-Opt-in an die NEUE Adresse — die Änderung gilt erst nach deren
 * Bestätigung. Die App darf deshalb nicht behaupten, sie sei schon vollzogen.
 */
export async function setzeEmail(
  newEmail: string,
  currentPassword: string,
): Promise<Result<Konto>> {
  return call("/auth/account/email", {
    method: "PATCH",
    body: { new_email: newEmail, current_password: currentPassword },
  });
}

/** Passwort ändern. `current_password` ist Pflicht, außer bei OAuth-Konten. */
export async function setzePasswort(
  newPassword: string,
  currentPassword?: string,
): Promise<Result<Konto>> {
  return call("/auth/account/password", {
    method: "PATCH",
    body: {
      new_password: newPassword,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    },
  });
}

export type ProfilEingabe = {
  phone?: string | null;
  additional_phone?: string | null;
  preferred_language?: string | null;
  website?: string | null;
  description?: string | null;
};

export async function setzeProfil(input: ProfilEingabe): Promise<Result<Konto>> {
  return call("/auth/account/profile", { method: "PATCH", body: input });
}

// --- Zwei-Faktor-Zustand -----------------------------------------------------

export type MfaFaktor = {
  id: string;
  /** totp | phone | webauthn */
  factor_type: string;
  friendly_name: string | null;
  status: string;
};

export type MfaStatus = {
  factors: MfaFaktor[];
  /** aal1 = nur Passwort, aal2 = zweiter Faktor gelöst. */
  aal: string;
  mfa_required: boolean;
  mfa_enrolled: boolean;
  /** Ende der Einrichtungsfrist (ISO) — null, wenn keine Pflicht besteht. */
  mfa_grace_until: string | null;
  recovery_codes_left: number;
  sms_available?: boolean;
};

export async function getMfaStatus(): Promise<Result<MfaStatus>> {
  return call("/auth/mfa/status");
}

/**
 * Neue Wiederherstellungscodes. Sie erscheinen EINMALIG im Klartext — danach
 * liegen sie nur als Hash. Alte Codes verfallen dabei.
 */
export async function neueWiederherstellungscodes(): Promise<
  Result<{ codes: string[] }>
> {
  return call("/auth/mfa/recovery-codes", { method: "POST", body: {} });
}

export async function faktorEntfernen(faktorId: string): Promise<Result<void>> {
  return call(`/auth/mfa/factors/${faktorId}`, { method: "DELETE" });
}

// --- Geräteverlauf -----------------------------------------------------------

export type LoginGeraet = {
  id: string;
  user_agent: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  last_seen_at: string | null;
  created_at: string | null;
};
// Kein `is_current`: das Schema des Servers (`login_devices.LoginDevice`) führt
// es nicht. Das aktuelle Gerät zu markieren, indem man es aus User-Agent oder
// IP errät, wäre eine Behauptung — und die falsche Zeile abzumelden heisst, sich
// selbst auszusperren (Wurzel 4).

export async function listGeraete(): Promise<Result<LoginGeraet[]>> {
  return call("/login-devices");
}

/** Alle ANDEREN Sitzungen beenden — die eigene bleibt bestehen. */
export async function andereGeraeteAbmelden(): Promise<
  Result<{ revoked: number }>
> {
  return call("/login-devices/others", { method: "DELETE" });
}

export async function geraetEntfernen(id: string): Promise<Result<void>> {
  return call(`/login-devices/${id}`, { method: "DELETE" });
}
