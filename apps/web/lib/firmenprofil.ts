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
