"use server";

// Firmen-/Rechnungsprofil (tenant_billing_profile) — Server-Actions gegen den
// vorhandenen Buchhaltungs-Endpoint. Wird im Onboarding (Firmendaten-Schritt)
// und später in den Einstellungen genutzt. Länderneutral (DACH + EU).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Felder, die der Onboarding-Firmendaten-Schritt erfasst (camelCase wie vom
// Backend akzeptiert). Adresse/Kontakt fließen zusätzlich in den Channex-Sync.
export type FirmenProfil = {
  companyName?: string;
  legalForm?: string;
  companyStreet?: string;
  companyHouseNumber?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyState?: string;
  companyCountry?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  // Steuer
  isSmallBusiness?: boolean;
  vatId?: string;
  taxNumber?: string;
  // Optional (Register / GF / Bank)
  companyRegister?: string;
  districtCourt?: string;
  firstName?: string;
  lastName?: string;
  iban?: string;
  bic?: string;
  // Stripe-KYC: Kontotyp (Einzelperson/Firma) + Geburtsdatum der vertretungs-
  // berechtigten Person. Wird beim Profil-Speichern an den Auto-Connect-Account
  // weitergereicht (für die Zahlungsfreischaltung). ownerDob = ISO YYYY-MM-DD.
  accountType?: "individual" | "company";
  ownerDob?: string;
};

// company_id ist serverseitig irrelevant (Profil = aktueller Tenant aus JWT),
// der Pfad braucht aber einen Platzhalter.
const COMPANY_PATH = "/buchhaltung/companies/me";

export async function getFirmenProfil(): Promise<Result<Record<string, unknown>>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<Record<string, unknown>>(COMPANY_PATH, { token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Laden fehlgeschlagen.",
    };
  }
}

// Firmenlogo hochladen (multipart) → Backend legt es in den Bucket, schreibt die
// URL ins Profil und gibt das aktualisierte Profil zurück. Gleiches Muster wie
// uploadPropertyImage: direkt ans FastAPI mit Bearer-Token (multipart umgeht den
// JSON-Proxy).
export async function uploadFirmenLogo(
  file: File,
): Promise<Result<Record<string, unknown>>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1/buchhaltung/companies/me/logo`, {
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
    return { ok: true, data: (await res.json()) as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

export async function saveFirmenProfil(
  profil: FirmenProfil,
): Promise<Result<Record<string, unknown>>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<Record<string, unknown>>(COMPANY_PATH, {
      method: "PATCH",
      body: profil,
      token,
    });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Speichern fehlgeschlagen.",
    };
  }
}
