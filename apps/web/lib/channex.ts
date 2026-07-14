"use server";

// Channel-Manager (Channex): Server-Actions gegen den FastAPI-channel_manager-
// Slice (/api/v1/channel-manager). OTA-Distribution: Property-Mapping, ARI-Push,
// Buchungs-Sync. Tenant-scoped; Business-Logik bleibt im Backend (PROJECT.md §2).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/channel-manager${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen ------------------------------------------------------------------
export type ChannexHealth = {
  slice: string;
  status: string;
  // Neutraler Feldname (Provider darf nicht im Network-Tab auftauchen).
  channel_manager_ready: boolean;
};

export type PropertyMap = {
  id: string;
  property_id: string;
  property_title: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
};

export type ChannexBooking = {
  id: string;
  external_id: string;
  ota_name: string | null;
  ota_reservation_code: string | null;
  status: string;
  arrival_date: string | null;
  departure_date: string | null;
  amount_cents: number | null;
  currency: string | null;
  customer: Record<string, unknown>;
  acknowledged_at: string | null;
};

export type AvailabilityUpdate = {
  room_type_map_id: string;
  date_from: string;
  date_to: string;
  availability: number;
};

export type RateUpdate = {
  rate_plan_map_id: string;
  date_from: string;
  date_to: string;
  rate_cents?: number;
  min_stay_arrival?: number;
  stop_sell?: boolean;
};

// Flow-Debugging: ein einzelner Channex-Call als Trace-Zeile (channex_debug_log).
export type ChannexDebugEntry = {
  id: string;
  property_id: string | null;
  step: string;
  channex_method: string;
  channex_path: string;
  request_body: unknown;
  response_body: unknown;
  channex_id: string | null;
  http_status: number | null;
  duration_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string | null;
};

// --- Health -----------------------------------------------------------------
export async function getChannexHealth(): Promise<Result<ChannexHealth>> {
  return call<ChannexHealth>("/health");
}

// --- Flow-Debugging (Portale-Sync-Verlauf) ----------------------------------
export async function listChannexDebugTrace(
  propertyId?: string,
  limit = 100,
): Promise<Result<{ items: ChannexDebugEntry[]; total: number }>> {
  const p = new URLSearchParams();
  if (propertyId) p.set("property_id", propertyId);
  p.set("limit", String(limit));
  return call<{ items: ChannexDebugEntry[]; total: number }>(
    `/debug/trace?${p.toString()}`,
  );
}

// --- Property-Mapping -------------------------------------------------------
export async function listPropertyMaps(): Promise<
  Result<{ items: PropertyMap[]; total: number }>
> {
  return call<{ items: PropertyMap[]; total: number }>("/properties");
}

export async function connectProperty(input: {
  property_id: string;
  external_property_ref?: string;
  title?: string;
  currency?: string;
}): Promise<Result<PropertyMap>> {
  const res = await call<PropertyMap>("/properties", {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath("/marktplatz");
  return res;
}

export async function disconnectProperty(mapId: string): Promise<Result<void>> {
  const res = await call<void>(`/properties/${mapId}`, { method: "DELETE" });
  if (res.ok) revalidatePath("/marktplatz");
  return res;
}

// Voll-Abgleich (Verfügbarkeit + Preise/Restriktionen, 500 Tage) für ein
// Objekt sofort einreihen — z. B. nach Ausfall oder vermutetem Drift.
export async function triggerFullSync(
  mapId: string,
): Promise<Result<{ status: string; property_id: string }>> {
  return call<{ status: string; property_id: string }>(
    `/properties/${mapId}/full-sync`,
    { method: "POST" },
  );
}

// --- ARI-Push ---------------------------------------------------------------
export async function pushAri(input: {
  availability?: AvailabilityUpdate[];
  rates?: RateUpdate[];
}): Promise<
  Result<{ availability_tasks: number; rate_tasks: number; warnings: string[] }>
> {
  return call("/ari", {
    method: "POST",
    body: { availability: input.availability ?? [], rates: input.rates ?? [] },
  });
}

// --- Kanäle (OTA) inhouse: Portale + verbundene Kanäle ----------------------
export type PortalField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
};

export type SupportedPortal = {
  code: string;
  label: string;
  icon: string;
  fields: PortalField[];
  // "credential" = Hotel-ID/Zugangsdaten eingeben; "oauth" = Verbindung über
  // OAuth-URL (Airbnb, kein eingebbares Credential).
  connection_type: "credential" | "oauth";
};

export type ChannelConnection = {
  id: string;
  portal: string;
  title: string | null;
  is_active: boolean;
};

// OTA-seitige Zimmer/Raten (aus mapping_details) + lokale Preispläne zum Zuordnen.
export type OtaRate = {
  id: number | string;
  title: string | null;
  pricing?: string | null;
  max_persons?: number | null;
  occupancies?: number[];
};
export type OtaRoom = {
  id: number | string;
  title: string | null;
  rates: OtaRate[];
};
export type LocalRatePlanOption = { rate_plan_map_id: string; title: string };
export type PrepareResult = {
  portal: string;
  ota_rooms: OtaRoom[];
  rate_plans: LocalRatePlanOption[];
};
export type ChannelMapping = {
  rate_plan_map_id: string;
  room_type_code: number;
  rate_plan_code: number;
  occupancy?: number;
  pricing_type?: string;
  primary_occ?: boolean;
  readonly?: boolean;
};

export async function listPortals(): Promise<Result<SupportedPortal[]>> {
  return call<SupportedPortal[]>("/portals");
}

export async function listChannels(): Promise<
  Result<{ items: ChannelConnection[]; total: number }>
> {
  return call<{ items: ChannelConnection[]; total: number }>("/channels");
}

// Schritt 1+2: Zugangsdaten prüfen + Zimmer/Raten holen (legt nichts an).
export async function prepareChannel(input: {
  property_id: string;
  portal_code: string;
  settings: Record<string, string>;
}): Promise<Result<PrepareResult>> {
  return call<PrepareResult>("/channels/prepare", {
    method: "POST",
    body: input,
  });
}

// Schritt 3+4: Kanal mit Zuordnung anlegen + aktivieren.
export async function connectChannel(input: {
  property_id: string;
  portal_code: string;
  title?: string;
  settings?: Record<string, string>;
  mappings: ChannelMapping[];
}): Promise<Result<ChannelConnection>> {
  return call<ChannelConnection>("/channels", { method: "POST", body: input });
}

export async function disconnectChannel(
  channelId: string,
): Promise<Result<void>> {
  return call<void>(`/channels/${channelId}`, { method: "DELETE" });
}

// --- Airbnb-OAuth (white-label, ohne iFrame) --------------------------------
// Airbnb hat kein eingebbares Credential: das Backend legt einen inaktiven Kanal
// an und liefert eine echte airbnb.com-OAuth-URL (öffnen ODER an Eigentümer
// kopieren). Status wird gepollt; Mapping + Aktivierung danach über finalize.
export type OAuthBeginResult = {
  channel_id: string;
  oauth_url: string;
  portal: string;
  status: string;
};
export type OAuthStatusResult = {
  connected: boolean;
  host_id: string | null;
  portal: string;
};

export async function beginChannelOAuth(input: {
  property_id: string;
  portal_code: string;
  title?: string;
  settings?: Record<string, unknown>;
}): Promise<Result<OAuthBeginResult>> {
  return call<OAuthBeginResult>(
    `/properties/${input.property_id}/channels/${input.portal_code}/oauth/begin`,
    {
      method: "POST",
      body: {
        property_id: input.property_id,
        portal_code: input.portal_code,
        title: input.title,
        settings: input.settings ?? {},
      },
    },
  );
}

export async function getChannelOAuthStatus(
  propertyId: string,
  portalCode: string,
): Promise<Result<OAuthStatusResult>> {
  return call<OAuthStatusResult>(
    `/properties/${propertyId}/channels/${portalCode}/oauth/status`,
  );
}

export async function finalizeOAuthChannel(input: {
  property_id: string;
  portal_code: string;
  mappings: ChannelMapping[];
}): Promise<Result<ChannelConnection>> {
  const res = await call<ChannelConnection>(
    `/properties/${input.property_id}/channels/${input.portal_code}/oauth/finalize`,
    {
      method: "POST",
      body: { property_id: input.property_id, portal_code: input.portal_code, mappings: input.mappings },
    },
  );
  if (res.ok) revalidatePath("/einstellungen");
  return res;
}

// Gespeicherte OTA-Verbindungen eines Objekts (Hotel-ID + Status pro Portal).
// White-label: nur Portal-Label, Hotel-ID, Status — keine rohen Credentials.
export type StoredChannelConnection = {
  portal_code: string;
  portal: string;
  hotel_id: string;
  channel_id: string | null;
  is_active: boolean;
  last_error: string | null;
  updated_at: string | null;
};

export async function listChannelConnections(
  propertyId: string,
): Promise<Result<{ items: StoredChannelConnection[]; total: number }>> {
  return call<{ items: StoredChannelConnection[]; total: number }>(
    `/properties/${propertyId}/connections`,
  );
}

// Kanal pro (Objekt × Portal) an-/abschalten (selektiver Stop-Sell).
// „Aus" stoppt ARI/Preis-Push und deaktiviert den Channex-Channel; eingehende
// Buchungen werden weiter importiert.
export async function setConnectionActive(
  propertyId: string,
  portalCode: string,
  isActive: boolean,
): Promise<Result<StoredChannelConnection>> {
  const res = await call<StoredChannelConnection>(
    `/properties/${propertyId}/connections/${portalCode}`,
    { method: "PATCH", body: { is_active: isActive } },
  );
  if (res.ok) revalidatePath("/einstellungen");
  return res;
}

// --- Bookings ---------------------------------------------------------------
export async function listChannexBookings(): Promise<
  Result<{ items: ChannexBooking[]; total: number }>
> {
  return call<{ items: ChannexBooking[]; total: number }>("/bookings");
}

export async function syncChannexBookings(): Promise<
  Result<{ fetched: number; saved: number; acknowledged: number; errors: string[] }>
> {
  const res = await call<{
    fetched: number;
    saved: number;
    acknowledged: number;
    errors: string[];
  }>("/bookings/sync", { method: "POST" });
  if (res.ok) revalidatePath("/marktplatz");
  return res;
}
