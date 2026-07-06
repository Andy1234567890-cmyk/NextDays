"use server";

// Konto- & 2FA-Server-Actions (Sicherheit-Seite). Rufen den FastAPI-auth-Slice
// (/auth/account, /auth/totp/*) mit dem Access-Token des eingeloggten Nutzers.
// Token-Quelle: FastAPI-Cookie nd_access ODER die Supabase-OAuth-Session
// (Google). Business-Logik bleibt in FastAPI (PROJECT.md §2).
import { revalidatePath } from "next/cache";

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
  // Effektive Lodgify-Berechtigungs-IDs (für UI-Gating; admin = alle).
  permissions: string[];
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
  tenant_id: string | null;
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

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
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

// Nutzer des eigenen Tenants (allgemein, ungefiltert).
export async function listTenantUsers(): Promise<Result<TenantUser[]>> {
  return call<TenantUser[]>("/auth/account/users");
}

// Für ein Objekt als Hauptkontakt wählbare Nutzer (§4.2/§4.3): admin/co_admin +
// dem Objekt zugewiesene Eigentümer + freigegebene Mitarbeiter — NICHT pauschal
// alle Tenant-Nutzer.
export async function listPropertyContacts(
  propertyId: string,
): Promise<Result<TenantUser[]>> {
  return call<TenantUser[]>(
    `/auth/account/properties/${propertyId}/contacts`,
  );
}

// Nutzerverwaltung (Konto → Benutzer): Admins sehen alle Nutzer plattformweit,
// Owner/Co-Admin nur den eigenen Tenant; normale Benutzer erhalten 403.
export async function listManagedUsers(): Promise<Result<TenantUser[]>> {
  return call<TenantUser[]>("/auth/account/managed-users");
}

// Neuen Nutzer anlegen (Konto → Benutzer-Wizard): Rolle + Berechtigungen.
export type InviteInput = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  permissions: string[];
};

export async function inviteUser(
  input: InviteInput,
): Promise<Result<{ user_id: string }>> {
  const res = await call<{ user_id: string }>("/auth/invite", {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath("/konto/nutzer");
  return res;
}

// --- Eigentümer-Objekt-Zuordnung (Lastenheft §4.2) -------------------------
// Welche Objekte ein Eigentümer-Login sehen darf. Steuert das read-only-Portal.
export type OwnerAssignment = { user_id: string; property_ids: string[] };

export async function getOwnerProperties(
  userId: string,
): Promise<Result<OwnerAssignment>> {
  return call<OwnerAssignment>(`/auth/owners/${userId}/properties`);
}

export async function setOwnerProperties(
  userId: string,
  propertyIds: string[],
): Promise<Result<OwnerAssignment>> {
  const res = await call<OwnerAssignment>(`/auth/owners/${userId}/properties`, {
    method: "PUT",
    body: { property_ids: propertyIds },
  });
  if (res.ok) revalidatePath("/konto/nutzer");
  return res;
}

// --- Mitarbeiter-Objekt-Freigabe (Lastenheft §4.3) -------------------------
// Welche Objekte ein Mitarbeiter (staff/cleaner) operativ sieht/bearbeitet.
export type StaffAssignment = { user_id: string; property_ids: string[] };

export async function getStaffProperties(
  userId: string,
): Promise<Result<StaffAssignment>> {
  return call<StaffAssignment>(`/auth/staff/${userId}/properties`);
}

export async function setStaffProperties(
  userId: string,
  propertyIds: string[],
): Promise<Result<StaffAssignment>> {
  const res = await call<StaffAssignment>(`/auth/staff/${userId}/properties`, {
    method: "PUT",
    body: { property_ids: propertyIds },
  });
  if (res.ok) revalidatePath("/konto/nutzer");
  return res;
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
