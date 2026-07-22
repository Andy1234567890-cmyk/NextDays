"use server";

// Entwickler-API-Zugang (Booking-„Machine Account"-Modell): der Betrieb erzeugt
// API-Clients (Client-ID + Secret) mit Scopes + Objekt-Beschränkung, Test/Live.
// Server-Actions gegen den FastAPI-api_clients-Slice. Nur manage_tenant.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
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

export type ApiClient = {
  id: string;
  client_id: string;
  name: string;
  is_test: boolean;
  scopes: string[];
  property_ids: string[];
  secret_last4: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string | null;
};

// Beim Erzeugen/Rotieren zusätzlich das Klartext-Secret (nur EINMAL).
export type ApiClientCreated = ApiClient & { client_secret: string };

export async function listApiClients(): Promise<Result<ApiClient[]>> {
  return call<ApiClient[]>("/api-clients");
}

export async function createApiClient(input: {
  name: string;
  isTest: boolean;
  scopes: string[];
  propertyIds: string[];
}): Promise<Result<ApiClientCreated>> {
  return call<ApiClientCreated>("/api-clients", {
    method: "POST",
    body: {
      name: input.name,
      is_test: input.isTest,
      scopes: input.scopes,
      property_ids: input.propertyIds,
    },
  });
}

export async function rotateApiClientSecret(
  clientPk: string,
): Promise<Result<ApiClientCreated>> {
  return call<ApiClientCreated>(`/api-clients/${clientPk}/rotate`, {
    method: "POST",
  });
}

export async function revokeApiClient(
  clientPk: string,
): Promise<Result<null>> {
  return call<null>(`/api-clients/${clientPk}`, { method: "DELETE" });
}
