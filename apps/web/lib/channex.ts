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

// Channex-Account (Portal-Group) des Tenants VERIFIZIERT sicherstellen. Vom
// Onboarding VOR dem Abschluss aufgerufen — schlägt der Aufruf fehl, darf das
// Onboarding NICHT als „fertig" gelten (Regel „vollständig oder nichts").
export async function ensureChannexAccount(): Promise<
  Result<{ channex_group_id: string }>
> {
  return call<{ channex_group_id: string }>("/ensure-account", {
    method: "POST",
  });
}

// Channex→DB-Spiegelung für den eigenen Tenant SOFORT ausführen (Onboarding-
// Import: nach Verbinden eines Bestands-Kanals die Objekte in die DB holen,
// ohne auf den 15-min-Tick zu warten). Idempotent.
export async function reconcileTenant(): Promise<
  Result<{ created: number; updated: number; soft_deleted: number; skipped: number }>
> {
  const res = await call<{
    created: number;
    updated: number;
    soft_deleted: number;
    skipped: number;
  }>("/reconcile", { method: "POST" });
  if (res.ok) revalidatePath("/objekte");
  return res;
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
  // UI-Hinweis für das Frontend: "text" (Standard) oder "email".
  type: "text" | "email";
};

export type SupportedPortal = {
  code: string;
  label: string;
  icon: string;
  fields: PortalField[];
  // "credential" = Hotel-ID/Zugangsdaten eingeben; "oauth" = Verbindung über
  // OAuth-URL (Airbnb, kein eingebbares Credential).
  connection_type: "credential" | "oauth";
  // Kuratierte Vorab-Anleitung (was zuerst im OTA-Extranet zu tun ist), oder
  // null, wenn wir für diesen Kanal keinen belegten Prozess kennen.
  setup_hint: string | null;
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
// Zuordnung auf ZIMMER-Ebene (Cloudbeds/SiteMinder-Standard): der Nutzer ordnet
// ein OTA-Zimmer einem eigenen Zimmer (Objekt) zu. Die Raten des Zimmers verbindet
// der Server automatisch (Primary-Rate) — keine Rate-Auswahl im UI.
export type LocalRoomOption = { local_property_id: string; title: string };
export type PrepareResult = {
  portal: string;
  ota_rooms: OtaRoom[];
  rooms: LocalRoomOption[];
};
export type ChannelMapping = {
  // Das eigene Zimmer (Objekt), dem dieses OTA-Zimmer zugeordnet wird.
  local_property_id: string;
  room_type_code: number;
  occupancy?: number;
  pricing_type?: string;
};

export async function listPortals(): Promise<Result<SupportedPortal[]>> {
  return call<SupportedPortal[]>("/portals");
}

// Kanal-zentrierte Übersicht für die Channel-Manager-Seite (Karten je Kanal mit
// Status + Objektzahl). Alle Zahlen tenant-lokal aus der DB aggregiert.
export type OtaChannelOverview = {
  kind: "ota";
  code: string;
  label: string;
  icon: string;
  connection_type: "oauth" | "credential";
  connected_count: number;
  // Vom Tenant in die Sidebar geholt (Dropdown „Kanal hinzufügen")?
  pinned: boolean;
};
export type MarketplaceChannelOverview = {
  kind: "marketplace";
  code: string;
  label: string;
  listed_count: number;
};
export type IcalChannelOverview = {
  kind: "ical";
  code: string;
  label: string;
  synced_count: number;
};
export type ChannelOverview = {
  ota: OtaChannelOverview[];
  marketplace: MarketplaceChannelOverview;
  ical: IcalChannelOverview;
};

export async function channelOverview(): Promise<Result<ChannelOverview>> {
  return call<ChannelOverview>("/overview");
}

// Detailfläche eines Kanals: je verbundenem Objekt eine Zuordnungszeile
// (Objekt ↔ OTA-Hotel-ID ↔ Sync-Status) — die Mapping-Tabelle der Kanal-
// Detailseite. Nur echte, tenant-eigene Verbindungen dieses Portals.
export type ChannelMappingRow = {
  property_id: string;
  property_title: string | null;
  ota_hotel_id: string | null;
  is_active: boolean;
  // Existiert eine Verbindung dieses Portals (verbunden vs. „Verbinden"-Button)?
  connected: boolean;
  sync_enabled: boolean;
  last_sync_status: string | null;
  last_sync_error: string | null;
  updated_at: string | null;
};
export type ChannelDetail = {
  portal_code: string;
  portal: string;
  connected: boolean;
  connected_count: number;
  total_count: number;
  mappings: ChannelMappingRow[];
};

export async function channelDetail(
  portalCode: string,
): Promise<Result<ChannelDetail>> {
  return call<ChannelDetail>(
    `/channels/${encodeURIComponent(portalCode)}/detail`,
  );
}

// --- Gepinnte Kanäle (Sidebar „Kanal hinzufügen") ---------------------------
export async function listPinnedChannels(): Promise<Result<{ codes: string[] }>> {
  return call<{ codes: string[] }>("/channels/pinned");
}

export async function pinChannel(portalCode: string): Promise<Result<void>> {
  const res = await call<void>("/channels/pinned", {
    method: "POST",
    body: { portal_code: portalCode },
  });
  if (res.ok) revalidatePath("/channels");
  return res;
}

export async function unpinChannel(portalCode: string): Promise<Result<void>> {
  const res = await call<void>(
    `/channels/pinned/${encodeURIComponent(portalCode)}`,
    { method: "DELETE" },
  );
  if (res.ok) revalidatePath("/channels");
  return res;
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

// CSV-Bestandsimport: Alt-/Direkt-/vergangene Buchungen, die NICHT über die
// OTA-API kommen. Vorlage-Download + Upload des Datei-Inhalts (Text). Teil-
// Import: gültige Zeilen werden angelegt, Fehlerzeilen einzeln gemeldet.
export type CsvImportResult = {
  total_rows: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export async function importBookingsCsv(
  content: string,
): Promise<Result<CsvImportResult>> {
  const res = await call<CsvImportResult>("/bookings/csv-import", {
    method: "POST",
    body: { content },
  });
  if (res.ok) revalidatePath("/reservierungen");
  return res;
}

// Leere CSV-Vorlage (nur Kopfzeile) als Text laden. Eigener fetch statt `api`
// (der Endpunkt liefert text/csv, nicht JSON). Der Client baut daraus den
// Datei-Download.
export async function getCsvTemplate(): Promise<Result<string>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(
      `${base}/api/v1/channel-manager/bookings/csv-template`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: `Fehler ${res.status}`, status: res.status };
    return { ok: true, data: await res.text() };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

// --- Lodgify-Import (nur lesend, aus dem alten PMS) -------------------------
export type LodgifyPreviewItem = {
  external_id: string;
  guest_name: string;
  arrival: string;
  departure: string;
  total: number | null;
  currency: string | null;
  source: string | null;
  status: string;
  importable: boolean;
};
export type LodgifyPreview = {
  total: number;
  importable: number;
  items: LodgifyPreviewItem[];
};

// Vorschau: Buchungen aus Lodgify lesen und ANZEIGEN (schreibt nichts). Der
// api_key ist der eigene Lodgify-Key des Kunden — nur im Request, nie gespeichert.
export async function previewLodgifyImport(input: {
  apiKey: string;
  includePast: boolean;
}): Promise<Result<LodgifyPreview>> {
  return call<LodgifyPreview>("/bookings/lodgify/preview", {
    method: "POST",
    body: { api_key: input.apiKey, include_past: input.includePast },
  });
}

export async function importLodgifyBookings(input: {
  apiKey: string;
  includePast: boolean;
}): Promise<Result<CsvImportResult>> {
  const res = await call<CsvImportResult>("/bookings/lodgify/import", {
    method: "POST",
    body: { api_key: input.apiKey, include_past: input.includePast },
  });
  if (res.ok) revalidatePath("/reservierungen");
  return res;
}

// EINMALIGER Bestandsimport der OTA-Buchungen aller verbundenen Objekte
// (Onboarding-Wechselkunde). includePast=false → nur Anreise ab heute;
// includePast=true → auch vergangene (was Channex kennt — echte Alt-Buchungen
// vor dem Connect sind über Channex ggf. nicht mehr abrufbar).
export async function importExistingBookings(
  includePast = false,
): Promise<
  Result<{ fetched: number; saved: number; acknowledged: number; errors: string[] }>
> {
  const res = await call<{
    fetched: number;
    saved: number;
    acknowledged: number;
    errors: string[];
  }>(`/bookings/import?include_past=${includePast ? "true" : "false"}`, {
    method: "POST",
  });
  if (res.ok) revalidatePath("/reservierungen");
  return res;
}
