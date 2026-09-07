"use server";

// Objektkartei (8-stufig, Lastenheft §6): Server-Actions gegen den FastAPI-
// property_dossier-Slice (/api/v1/property-dossier). Enum-Werte sind sprach-
// neutrale Keys (Labels via next-intl). Stufe 1 (Eigentümer) ist read-only aus
// dem owners-Slice; Objekt-Basisfelder laufen über updateProperty (lib/properties).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen (exakt am Pydantic-Contract; Enum-Felder = neutrale Keys) --------
export type LinkedOwner = {
  owner_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  account_holder: string | null;
  // Dänische Bankverbindung (0581) neben IBAN/BIC.
  bank_reg_nr: string | null;
  bank_konto_nr: string | null;
  tax_id: string | null;
  vat_id: string | null;
  cpr_number: string | null;
  ownership_share: number | null;
};

export type ProcessData = {
  first_meeting_at: string | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  onboarding_invoice_sent_at: string | null;
  onboarding_invoice_paid_at: string | null;
};

export type AccessData = {
  key_status: string | null;
  key_placement: string | null;
};

export type ServiceAgreementInput = {
  service_type: string;
  frequency: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
};
export type ServiceAgreement = ServiceAgreementInput & { id: string };

export type TradespersonInput = {
  trade: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
};
export type Tradesperson = TradespersonInput & { id: string };

export type EmergencyAuthority = {
  authority_mode: string | null;
  authority_limit: number | null;
  currency: string | null;
};

export type MarketingData = {
  photographer_booked_at: string | null;
  media_received_at: string | null;
  site_walkthrough_at: string | null;
  defects_list_sent_at: string | null;
};

export type HousebookData = {
  welcome_text_status: string | null;
  physical_folder_placed: boolean;
  /** Geheimtipps des Eigentümers (0582), Freitext bis 5000 Zeichen. */
  secret_tips: string | null;
};

export type PlatformLaunchInput = {
  platform: string;
  launch_at: string | null;
  status: string | null;
};
export type PlatformLaunch = PlatformLaunchInput & { id: string };

export type DossierFull = {
  owner: LinkedOwner | null;
  process: ProcessData;
  access: AccessData;
  service_agreements: ServiceAgreement[];
  tradespeople: Tradesperson[];
  emergency_authority: EmergencyAuthority;
  marketing: MarketingData;
  housebook: HousebookData;
  platform_launches: PlatformLaunch[];
};

const BASE = "/property-dossier";

export async function getDossier(pid: string): Promise<Result<DossierFull>> {
  return call(`${BASE}/${pid}/full`);
}

// Stufe 2
export async function saveProcess(pid: string, input: ProcessData): Promise<Result<ProcessData>> {
  return call(`${BASE}/${pid}/process`, { method: "PUT", body: input });
}

// Stufe 3
export async function saveAccess(pid: string, input: AccessData): Promise<Result<AccessData>> {
  return call(`${BASE}/${pid}/access`, { method: "PUT", body: input });
}

// Stufe 4
export async function addServiceAgreement(pid: string, input: ServiceAgreementInput): Promise<Result<ServiceAgreement>> {
  return call(`${BASE}/${pid}/service-agreements`, { method: "POST", body: input });
}
export async function updateServiceAgreement(pid: string, id: string, input: ServiceAgreementInput): Promise<Result<ServiceAgreement>> {
  return call(`${BASE}/${pid}/service-agreements/${id}`, { method: "PUT", body: input });
}
export async function deleteServiceAgreement(pid: string, id: string): Promise<Result<null>> {
  return call(`${BASE}/${pid}/service-agreements/${id}`, { method: "DELETE" });
}

// Stufe 5
export async function addTradesperson(pid: string, input: TradespersonInput): Promise<Result<Tradesperson>> {
  return call(`${BASE}/${pid}/tradespeople`, { method: "POST", body: input });
}
export async function updateTradesperson(pid: string, id: string, input: TradespersonInput): Promise<Result<Tradesperson>> {
  return call(`${BASE}/${pid}/tradespeople/${id}`, { method: "PUT", body: input });
}
export async function deleteTradesperson(pid: string, id: string): Promise<Result<null>> {
  return call(`${BASE}/${pid}/tradespeople/${id}`, { method: "DELETE" });
}
export async function saveEmergencyAuthority(pid: string, input: EmergencyAuthority): Promise<Result<EmergencyAuthority>> {
  return call(`${BASE}/${pid}/emergency-authority`, { method: "PUT", body: input });
}

// Stufe 6
export async function saveMarketing(pid: string, input: MarketingData): Promise<Result<MarketingData>> {
  return call(`${BASE}/${pid}/marketing`, { method: "PUT", body: input });
}

// Stufe 7
export async function saveHousebook(pid: string, input: HousebookData): Promise<Result<HousebookData>> {
  return call(`${BASE}/${pid}/housebook`, { method: "PUT", body: input });
}

// Stufe 8
export async function addPlatformLaunch(pid: string, input: PlatformLaunchInput): Promise<Result<PlatformLaunch>> {
  return call(`${BASE}/${pid}/platform-launches`, { method: "POST", body: input });
}
export async function updatePlatformLaunch(pid: string, id: string, input: PlatformLaunchInput): Promise<Result<PlatformLaunch>> {
  return call(`${BASE}/${pid}/platform-launches/${id}`, { method: "PUT", body: input });
}
export async function deletePlatformLaunch(pid: string, id: string): Promise<Result<null>> {
  return call(`${BASE}/${pid}/platform-launches/${id}`, { method: "DELETE" });
}
