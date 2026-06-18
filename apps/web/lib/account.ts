"use server";

// Konto- & 2FA-Server-Actions (Sicherheit-Seite). Rufen den FastAPI-auth-Slice
// (/auth/account, /auth/totp/*) mit dem Access-Token des eingeloggten Nutzers.
// Token-Quelle: FastAPI-Cookie nd_access ODER die Supabase-OAuth-Session
// (Google). Business-Logik bleibt in FastAPI (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type UserRole = "admin" | "co_admin" | "owner" | "staff" | "cleaner";

export type Account = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  has_password: boolean;
  totp_enabled: boolean;
  role: UserRole | null;
  // Profilfelder (wie Lodgify „Contact information").
  phone: string | null;
  additional_phone: string | null;
  hide_phones: boolean;
  preferred_language: string | null;
  spoken_languages: string[];
  website: string | null;
  description: string | null;
  avatar_url: string | null;
};

// Ein Nutzer des eigenen Tenants (für die Objekt-Kontakt-Auswahl).
export type TenantUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole | null;
  phone: string | null;
  avatar_url: string | null;
};

// Profil-/Kontaktdaten-Update (nur gesetzte Felder werden geschrieben).
export type ProfileInput = {
  full_name?: string;
  phone?: string | null;
  additional_phone?: string | null;
  hide_phones?: boolean;
  preferred_language?: string | null;
  spoken_languages?: string[];
  website?: string | null;
  description?: string | null;
  avatar_url?: string | null;
};

export type TotpEnroll = {
  secret: string;
  otpauth_uri: string;
  qr_data_url: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

// --- Konto -----------------------------------------------------------------

export async function getAccount(): Promise<Result<Account>> {
  return call<Account>("/auth/account");
}

export async function updateEmail(newEmail: string): Promise<Result<Account>> {
  return call<Account>("/auth/account/email", {
    method: "PATCH",
    body: { new_email: newEmail },
  });
}

export async function updateName(fullName: string): Promise<Result<Account>> {
  return call<Account>("/auth/account/name", {
    method: "PATCH",
    body: { full_name: fullName },
  });
}

// Profil-/Kontaktdaten (Lodgify „Edit contact information") aktualisieren.
export async function updateProfile(
  input: ProfileInput,
): Promise<Result<Account>> {
  return call<Account>("/auth/account/profile", {
    method: "PATCH",
    body: input,
  });
}

// Nutzer des eigenen Tenants (für die Kontakt-Auswahl eines Objekts).
export async function listTenantUsers(): Promise<Result<TenantUser[]>> {
  return call<TenantUser[]>("/auth/account/users");
}

// Profilbild hochladen (multipart). Läuft übers Backend (Service-Client), damit
// es für beide Login-Wege funktioniert — auch ohne Supabase-Browser-Session.
export async function uploadAvatar(
  file: File,
): Promise<Result<Account>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1/auth/account/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as Account };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

export async function updatePassword(
  newPassword: string,
  currentPassword?: string,
): Promise<Result<Account>> {
  return call<Account>("/auth/account/password", {
    method: "PATCH",
    body: { new_password: newPassword, current_password: currentPassword ?? null },
  });
}

// --- TOTP-2FA --------------------------------------------------------------

export async function totpEnroll(): Promise<Result<TotpEnroll>> {
  return call<TotpEnroll>("/auth/totp/enroll", { method: "POST" });
}

export async function totpVerify(
  code: string,
): Promise<Result<{ totp_enabled: boolean; recovery_codes: string[] }>> {
  return call("/auth/totp/verify", { method: "POST", body: { code } });
}

export async function totpDisable(code: string): Promise<Result<Account>> {
  return call<Account>("/auth/totp/disable", { method: "POST", body: { code } });
}
