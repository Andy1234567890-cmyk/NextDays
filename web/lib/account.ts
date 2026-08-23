"use server";

// Konto- & 2FA-Server-Actions (Sicherheit-Seite). Rufen den FastAPI-auth-Slice
// (/auth/account) mit dem Access-Token des eingeloggten Nutzers.
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
  // ACHTUNG: seit 0341 NICHT mehr die Wahrheit ueber den zweiten Faktor —
  // die liefert `GET /auth/mfa/status` (GoTrue). Feld bleibt, weil das Backend
  // es weiterhin ausliefert; fuer 2FA-Entscheidungen NICHT verwenden.
  totp_enabled: boolean;
  role: UserRole | null;
  // Effektive Berechtigungs-IDs (für UI-Gating; admin = alle).
  permissions: string[];
  // Profilfelder (Kontaktdaten).
  phone: string | null;
  additional_phone: string | null;
  hide_phones: boolean;
  preferred_language: string | null;
  spoken_languages: string[];
  website: string | null;
  description: string | null;
  avatar_url: string | null;
  // Land des Unternehmens (ISO-2) — z. B. Vorbelegung der Telefon-Vorwahl.
  tenant_country: string | null;
  // Zeitpunkt der SMS-Verifizierung der Telefonnummer. Seit 0341 KEIN
  // 2FA-Signal mehr (der SMS-Faktor liegt in GoTrue) — nur noch die Info,
  // ob die hinterlegte Nummer bestaetigt ist.
  phone_verified_at: string | null;
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
  // WIRKSAME Berechtigungs-IDs (admin = alle): Rolle plus gespeicherte, durch
  // das PM-Dach gefiltert. Für Anzeige und Gating — NICHT als Vorbelegung des
  // Bearbeiten-Dialogs, dafür ist `stored_permissions` da.
  permissions: string[];
  // GESPEICHERTE Berechtigungs-IDs, ungefiltert (`users.permissions`).
  //
  // Die Vorbelegung des Bearbeiten-Dialogs MUSS hierher greifen. Vorher stand
  // dort `permissions`, also die gefilterte Anzeige — und Speichern schrieb sie
  // zurück. Alles, was das PM-Dach ausgeblendet hatte, war danach dauerhaft
  // gelöscht, ohne dass es jemand angeklickt hätte. Live traf das die Rolle
  // `owner`: 6 gespeicherte Rechte, 2 sichtbare, 4 pro Speichervorgang
  // verloren (23.08.2026 gemessen).
  //
  // Optional, weil ältere Server-Fassungen das Feld nicht senden; der Dialog
  // fällt dann auf `permissions` zurück und verhält sich wie bisher.
  stored_permissions?: string[];
  // Sprache der E-Mails an diesen Nutzer (ISO-639-1). `null` heißt „nicht
  // erfasst" — dann greift serverseitig die Kette Betriebssprache → Englisch,
  // und der Bearbeiten-Dialog zeigt „nicht gesetzt" statt einer erfundenen
  // Sprache.
  preferred_language?: string | null;
  // Kontakt-/Zusatzangaben der Detailseite (/konto/nutzer/<id>, Migration 0356).
  additional_phone?: string | null;
  hide_phones?: boolean;
  spoken_languages?: string[];
  notes?: string | null;
  // Zugang gesperrt? `deactivated_at` ist die Wahrheit (null = aktiv),
  // `is_active` nur die Ableitung daraus — nie unabhängig setzen.
  deactivated_at?: string | null;
  is_active?: boolean;
  created_at?: string | null;
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


type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
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

export async function updateEmail(
  newEmail: string,
  currentPassword?: string,
): Promise<Result<Account>> {
  return call<Account>("/auth/account/email", {
    method: "PATCH",
    body: {
      new_email: newEmail,
      // Re-Auth wie beim Passwortwechsel; der Server verlangt es nur, wenn das
      // Konto überhaupt ein Passwort hat (OAuth-Konten haben keins).
      ...(currentPassword ? { current_password: currentPassword } : {}),
    },
  });
}

export async function updateName(fullName: string): Promise<Result<Account>> {
  return call<Account>("/auth/account/name", {
    method: "PATCH",
    body: { full_name: fullName },
  });
}

// Profil-/Kontaktdaten (Kontaktinformationen) aktualisieren.
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
//
// Bewusst OHNE `password`: der Server legt den Zugang an und verschickt eine
// Einladungs-Mail; der Eingeladene setzt sein Passwort selbst unter
// /einladung?token=…. Früher erzeugte der Wizard hier clientseitig ein
// Passwort und zeigte es im Klartext an — ein Geheimnis, das der Betreiber
// kannte, ist keins.
export type InviteInput = {
  email: string;
  full_name: string;
  role: UserRole;
  permissions: string[];
  // Sprache, in der dieser Nutzer seine E-Mails bekommt (ISO-639-1, eine der 24
  // Locales aus i18n/locales.ts) — beginnend mit der Einladungs-Mail.
  //
  // FELDNAME: `preferred_language`, wie er für Nutzer bereits etabliert ist
  // (`users.preferred_language`, siehe `Account`/`ProfileInput` oben und
  // docs/API.md → POST /auth/invite bzw. PATCH /auth/account/profile).
  //
  // Optional, weil „nicht erfasst" eine echte Antwort ist: der Server speichert
  // dann NULL, und die Kette Betriebssprache → Englisch greift. Ein unbekannter
  // Code wird serverseitig mit 422 abgelehnt — nicht stillschweigend ignoriert.
  preferred_language?: string;
  // Kontakt-/Zusatzangaben aus dem Wizard (Schritt 1 + 2). Bis 0356 standen die
  // Felder in der Oberfläche, gingen aber NICHT mit — die Eingabe war eine
  // Attrappe. Optional, weil „nicht erfasst" eine echte Antwort ist.
  phone?: string;
  additional_phone?: string;
  hide_phones?: boolean;
  spoken_languages?: string[];
  notes?: string;
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

// Nutzer bearbeiten (Konto → Benutzer): Name, Rolle, feingranulare Rechte
// (admin/co_admin). `permissions` = null/undefined lässt die Rechte unverändert;
// eine (auch leere) Liste ersetzt sie — das Backend klemmt auf die eigenen
// Rechte des Bearbeitenden.
// `preferred_language` = Sprache der E-Mails an diesen Nutzer (ISO-639-1).
// Feldname wie bei `InviteInput`; weggelassen = unverändert.
export async function updateManagedUser(
  userId: string,
  input: {
    full_name?: string;
    role?: UserRole;
    permissions?: string[];
    preferred_language?: string;
    // Kontaktdaten/Zusatzangaben (Detailseite). NUR mitgeschickte Felder werden
    // gesetzt. Ein Leerstring heißt ausdrücklich „löschen" (Server macht NULL) —
    // nur so lässt sich eine falsch eingetragene Nummer wieder entfernen.
    phone?: string;
    additional_phone?: string;
    hide_phones?: boolean;
    spoken_languages?: string[];
    notes?: string;
  },
): Promise<Result<TenantUser>> {
  const res = await call<TenantUser>(`/auth/account/users/${userId}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) {
    revalidatePath("/konto/nutzer");
    revalidatePath(`/konto/nutzer/${userId}`);
  }
  return res;
}

// Ein Nutzer der Verwaltung (Detailseite /konto/nutzer/<id>). Gleicher Scope wie
// die Liste — staff/cleaner erhalten 403, fremde Tenants 404.
export async function getManagedUser(
  userId: string,
): Promise<Result<TenantUser>> {
  return call<TenantUser>(`/auth/account/users/${userId}`);
}

// Antwort von Deaktivieren/Aktivieren. `login_gesperrt` = Zustand des
// ANMELDEDIENSTES; er kann von `user.is_active` abweichen (Teilerfolg), und
// genau das benennt die Oberfläche statt es zu verschweigen.
export type UserStatusResult = {
  user: TenantUser;
  login_gesperrt: boolean;
};

// Zugang sperren, ohne zu löschen. Zuordnungen und Historie bleiben stehen.
export async function deactivateManagedUser(
  userId: string,
): Promise<Result<UserStatusResult>> {
  const res = await call<UserStatusResult>(
    `/auth/account/users/${userId}/deactivate`,
    { method: "POST" },
  );
  if (res.ok) {
    revalidatePath("/konto/nutzer");
    revalidatePath(`/konto/nutzer/${userId}`);
  }
  return res;
}

// Gegenzustand: Zugang wieder freischalten (Feld UND GoTrue-Bann).
export async function activateManagedUser(
  userId: string,
): Promise<Result<UserStatusResult>> {
  const res = await call<UserStatusResult>(
    `/auth/account/users/${userId}/activate`,
    { method: "POST" },
  );
  if (res.ok) {
    revalidatePath("/konto/nutzer");
    revalidatePath(`/konto/nutzer/${userId}`);
  }
  return res;
}

// Nutzer löschen (Konto → Benutzer): entfernt Login + Zuordnungen
// (admin/co_admin; eigener Login und Kontoinhaber sind geschützt).
export async function deleteManagedUser(
  userId: string,
): Promise<Result<void>> {
  const res = await call<void>(`/auth/account/users/${userId}`, {
    method: "DELETE",
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

// --- 2FA ------------------------------------------------------------------
// Seit 0341 liegt die 2FA GoTrue-nativ (siehe lib/mfa.ts und lib/mfa-client.ts).
// Die frueheren Wege ueber /auth/totp/* und /auth/phone/* sind stillgelegt
// (das Backend antwortet dort 410) und wurden hier entfernt, damit es keine
// zweite, tote Anbindung gibt.
