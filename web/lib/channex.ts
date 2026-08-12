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
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
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
// Wert eines Portalfelds: Text/Passwort/Auswahl (string), Schalter (boolean)
// oder Zahl — je nach Feldtyp aus dem Kanal-Katalog.
export type PortalValue = string | boolean | number | null;

// Sichtbarkeitsregel aus dem Katalog: `apply` ("hidden") greift, sobald
// `influence_field` den Wert `when` hat (z.B. E-Mail nur bei aktiver
// Benachrichtigung).
export type PortalFieldRule = {
  apply: string;
  when: PortalValue;
  influence_field: string;
};

export type PortalField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  // Render-Hinweis aus dem Kanal-Katalog.
  type: "text" | "email" | "password" | "checkbox" | "select" | "switch" | "number";
  // Vorbelegung aus dem Katalog (bzw. vorbefüllte Betriebs-E-Mail); null = leer.
  default: PortalValue;
  // Auswahlwerte bei select/switch.
  options: string[];
  // Optionale Einstellung → Bereich „Erweiterte Einstellungen".
  advanced: boolean;
  rules: PortalFieldRule[];
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
  // Zuordnungsart des Kanals (Katalog): steuert, ob/wie zugeordnet wird.
  mapping_mode: string | null;
  mapping_required: boolean;
  // Bezugswährung des Mindestpreises (keine Pflichtwährung des Kanals).
  min_price_currency: string | null;
  min_price: number | null;
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
export type LocalRoomOption = {
  local_property_id: string;
  title: string;
  // Vorgeschlagener Booking-Zimmertyp (BCRT) aus dem lokalen property_type — für
  // die Vorauswahl des passenden OTA-Zimmers. null = keine Entsprechung.
  suggested_bcrt_code: number | null;
  suggested_bcrt_name: string | null;
  // Bei einem aus Airbnb übernommenen Objekt: die Airbnb-Listing-ID. Damit ist
  // die Zuordnung Anzeige→Objekt eindeutig und muss nicht über Namen geraten
  // werden. null = nicht aus Airbnb übernommen.
  airbnb_listing_id: string | null;
};
export type PrepareResult = {
  portal: string;
  ota_rooms: OtaRoom[];
  rooms: LocalRoomOption[];
};
export type ChannelMapping = {
  // Das eigene Zimmer (Objekt), dem dieses OTA-Zimmer zugeordnet wird.
  local_property_id: string;
  // STRING: Airbnb-Listing-IDs (19-stellig) verlieren als JS-`number`
  // Präzision — `1133122057704952480` würde zu `…400`. Das Backend nimmt
  // `int | str`, Booking-Codes gehen als Ziffernstring genauso durch.
  room_type_code: string;
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
  // Objekte, deren Abgleich LÄUFT (Kanal bei Channex aktiv).
  connected_count: number;
  // Objekte, für die eine Verbindung BESTEHT — auch ohne laufenden Abgleich.
  // Bei OAuth-Portalen (Airbnb) liegen zwischen „Konto verbunden" und „Abgleich
  // läuft" mehrere Schritte; ohne diese Zahl zeigte die Karte „Verbinden",
  // obwohl das Konto längst autorisiert war.
  linked_count: number;
  // Vom Tenant in die Sidebar geholt (Dropdown „Kanal hinzufügen")?
  pinned: boolean;
};
export type MarketplaceChannelOverview = {
  kind: "marketplace";
  code: string;
  label: string;
  // Auf dem Marktplatz WIRKLICH sichtbar (aktiv + gelistet + freigegeben).
  listed_count: number;
  // Gelistet, aber noch ohne Freigabe des Betreibers → dort nicht sichtbar.
  pending_count: number;
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

// Detailfläche des EIGENEN Marktplatzes (/channels/mybestdays). Pendant zur
// OTA-Kanalseite, aber ohne Channex: Sichtbarkeit ist der lokale Schalter
// (`listed_on_marketplace`) UND die Freigabe des Betreibers (moderation_status).
export type MarketplacePropertyRow = {
  property_id: string;
  title: string;
  city: string | null;
  country: string | null;
  status: string | null;
  listed: boolean;
  moderation_status: string | null;
  /** active = auf myBestDays sichtbar · pending = Freigabe offen · paused = aus. */
  state: "active" | "pending" | "paused";
  /** Öffentliche Inserat-Seite; null, solange es dort keine gibt. */
  listing_url: string | null;
  photo: string | null;
  bookings_count: number;
};

export type MarketplaceDetail = {
  code: string;
  label: string;
  /** "" = Marktplatz-Adresse nicht konfiguriert → kein Link anzeigen. */
  marketplace_url: string;
  listed_count: number;
  pending_count: number;
  items: MarketplacePropertyRow[];
};

export async function marketplaceDetail(): Promise<Result<MarketplaceDetail>> {
  return call<MarketplaceDetail>("/marketplace");
}

// Detailfläche eines Kanals: je verbundenem Objekt eine Zuordnungszeile
// (Objekt ↔ OTA-Hotel-ID ↔ Sync-Status) — die Mapping-Tabelle der Kanal-
// Detailseite. Nur echte, tenant-eigene Verbindungen dieses Portals.
export type ChannelMappingRow = {
  property_id: string;
  property_title: string | null;
  /** Titelbild des Objekts (Cover, sonst erstes Foto); null = keins. */
  property_photo: string | null;
  /** Teilt dieses Objekt seine Portal-Kennung mit einem bereits verbundenen
   *  (gemeinsames Gebäude)? Nur dann darf der Assistent die bestehende
   *  Hotel-ID übernehmen; sonst hat das Objekt eine EIGENE Kennung. */
  shares_building: boolean;
  ota_hotel_id: string | null;
  // OTA-Zimmertyp, auf den dieses Objekt gemappt ist (Code + Klarname) — die
  // Anzeige nutzt Titel/Code, nicht die Hotel-ID (für alle Zimmer gleich).
  ota_room_type_code: string | null;
  ota_room_title: string | null;
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
  // Channex-Kanal-ID des Portals (Hotels: alle Zimmer teilen einen Kanal); für
  // „Verbindung trennen". null = nicht verbunden.
  channel_id: string | null;
  /** ALLE Kanal-IDs dieses Portals — eine je eigener Portal-Kennung. Bei
   *  einzelnen Ferienhäusern hat jedes Haus seine eigene Hotel-ID und damit
   *  einen eigenen Kanal; portalweite Aktionen müssen über ALLE laufen, nicht
   *  über `channel_id` (das ist nur ein Vertreter). */
  channel_ids: string[];
  // Kanal-eigene Aktionen aus dem Katalog (z.B. "load_future_reservations").
  actions: string[];
  // Läuft der Kanal bei Channex? Verbunden ≠ aktiv — Channex legt Kanäle
  // INAKTIV an. null = unbekannt (Abruf fehlgeschlagen), nicht "inaktiv".
  channel_active: boolean | null;
  // Was der Aktivierung noch fehlt (Klartext). Leer/null = bereit.
  readiness_offen: string | null;
  mappings: ChannelMappingRow[];
};

// Eine kanal-eigene Aktion auslösen. Welche es gibt, sagt `ChannelDetail.actions`.
/** Ergebnis einer Kanal-Aktion. `fetched`/`saved` sind die ECHTEN Zahlen des
 *  anschließenden Buchungs-Imports — ohne sie könnte die Oberfläche nur „ok"
 *  melden, während das Portal gerade nichts geliefert hat (oder zehn Buchungen
 *  unterwegs sind). */
export async function runChannelAction(
  channelId: string,
  action: string,
): Promise<
  Result<{
    status: string;
    action: string;
    fetched?: number;
    saved?: number;
    skipped?: number;
  }>
> {
  return call<{
    status: string;
    action: string;
    fetched?: number;
    saved?: number;
    skipped?: number;
  }>(`/channels/${channelId}/actions/${action}`, { method: "POST" });
}

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
  settings: Record<string, PortalValue>;
  /**
   * WELCHES Portal-Konto (0304). Bei einer Agentur mit mehreren Zugängen je
   * Portal entscheidet es, mit wessen Token die Anzeigen geholt werden. Ohne
   * Angabe nimmt der Server das Konto aus der Verbindungszeile des Objekts —
   * richtig für ein bereits zugeordnetes Objekt, aber nicht für ein neues.
   */
  account_id?: string | null;
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
  settings?: Record<string, PortalValue>;
  mappings: ChannelMapping[];
}): Promise<Result<ChannelConnection>> {
  return call<ChannelConnection>("/channels", { method: "POST", body: input });
}

export async function disconnectChannel(
  channelId: string,
): Promise<Result<void>> {
  return call<void>(`/channels/${channelId}`, { method: "DELETE" });
}

/**
 * Ein Portal-Zugang eines Betriebs (0304). Ein Betrieb kann je Portal mehrere
 * führen — Agenturen betreuen hunderte Vermieter mit je eigenem Konto.
 */
export type OtaAccount = {
  id: string;
  portal_code: string;
  portal: string;
  /** Kennung beim Portal. null, solange die Autorisierung läuft. */
  hotel_id: string | null;
  channel_id: string | null;
  display_name: string | null;
  is_active: boolean;
  /** Tokens abgelaufen → der Betrieb muss neu autorisieren. */
  token_invalid: boolean;
  last_error: string | null;
  connected_at: string | null;
  properties: number;
};

export async function listChannelAccounts(
  portalCode: string,
): Promise<Result<{ items: OtaAccount[]; total: number }>> {
  return call<{ items: OtaAccount[]; total: number }>(
    `/channels/${portalCode}/accounts`,
  );
}

/**
 * Den Kanal abholen, den Channex nach der Autorisierung selbst angelegt hat.
 *
 * Bei einer neuen Verbindung legen WIR keinen Kanal an — Channex tut es, sobald
 * der Vermieter bei Airbnb bestätigt („we will automatically create a new
 * inactive Channel", Airbnb Connection API). Danach steht der Kanal dort, das
 * Konto bei uns wartet aber noch ohne Kanal-ID und die Oberfläche zeigt
 * „Verbindung läuft". Dieser Aufruf schließt die Lücke — er liest bei Channex
 * und trägt in unsere DB nach.
 */
export async function kanalNachtragen(
  accountId: string,
  portalCode = "AirBNB",
): Promise<Result<{ channel_id: string | null; neu: boolean }>> {
  return call<{ channel_id: string | null; neu: boolean }>(
    `/channels/accounts/${accountId}/kanal-nachtragen?portal_code=${portalCode}`,
    { method: "POST" },
  );
}

export async function renameChannelAccount(
  accountId: string,
  displayName: string | null,
): Promise<Result<OtaAccount>> {
  return call<OtaAccount>(`/channels/accounts/${accountId}`, {
    method: "PATCH",
    body: { display_name: displayName },
  });
}

export type ChannelActivateResult = {
  channel_active: boolean | null;
  readiness_offen: string | null;
};

// Einen verbundenen, aber inaktiven Kanal live schalten. Channex legt Kanäle
// INAKTIV an; scheitert die Aktivierung beim Verbinden an fehlenden Angaben,
// ist dies der einzige Weg zurück. Fehlen weiterhin Angaben → 422 mit Grund.
export async function activateChannel(
  channelId: string,
): Promise<Result<ChannelActivateResult>> {
  return call<ChannelActivateResult>(`/channels/${channelId}/activate`, {
    method: "POST",
  });
}

// --- Airbnb-OAuth (white-label, ohne iFrame) --------------------------------
// Airbnb hat kein eingebbares Credential: das Backend legt einen inaktiven Kanal
// an und liefert eine echte airbnb.com-OAuth-URL (öffnen ODER an Eigentümer
// kopieren). Status wird gepollt; Mapping + Aktivierung danach über finalize.
export type OAuthBeginResult = {
  /**
   * Null bei einer NEUEN Verbindung: den Kanal legt Channex erst an, wenn die
   * Autorisierung eintrifft. Gesetzt nur beim Wiederverbinden.
   */
  channel_id: string | null;
  oauth_url: string;
  portal: string;
  status: string;
  /**
   * Das Konto, für das dieser Link gilt (0304). Festhalten und bei jedem
   * Folge-Aufruf zurückgeben — sonst weiß der Server beim zweiten Klick nicht
   * mehr, welcher Zugang gemeint war, und erzeugt den Link für den bereits
   * verbundenen. Nur beim Mehrkonto-Weg gesetzt.
   */
  account_id: string | null;
};
export type OAuthStatusResult = {
  connected: boolean;
  host_id: string | null;
  portal: string;
  // Grund, warum die Verbindung (noch) nicht steht — vom Portal gemeldet, z.B.
  // dass dort bereits eine andere Software verbunden ist. Muss dem Kunden
  // gezeigt werden, sonst wartet er endlos auf eine Bestätigung, die nie kommt.
  last_error?: string | null;
};

/**
 * Airbnb-OAuth für ein BESTEHENDES Objekt starten. Ohne Objekt gibt es diesen
 * Weg nicht: Channex' `connection_link` verlangt mindestens ein Property (live
 * geprüft, sonst 422). Wer noch keine Objekte hat, nutzt
 * `startAirbnbUebernahme` — dort legt der Server das eine nötige Objekt selbst
 * an, statt es vom Kunden zu verlangen.
 */
export async function beginChannelOAuth(input: {
  property_id: string;
  portal_code: string;
  title?: string;
  settings?: Record<string, unknown>;
  /**
   * Ein WEITERES Portal-Konto verbinden (0304), statt den bestehenden Kanal
   * wiederzuverwenden. Ohne das Kennzeichen gäbe der Server den bereits
   * autorisierten Kanal zurück — der Kunde landete im Login des ERSTEN Kontos
   * und käme nie zum zweiten.
   */
  neues_konto?: boolean;
  /**
   * Wohin der Kunde nach der Autorisierung zurückkommt.
   *
   * Muss der Aufrufer liefern: diese Datei läuft als Server-Action, dort gibt
   * es kein `window`. Der Server prüft die Adresse gegen die erlaubten
   * Origins. Ohne sie bleibt der Kunde nach dem Airbnb-Login bei Channex
   * stehen — und bei einer Agentur mit vielen Zugängen wüsste niemand, welches
   * Konto gerade verbunden wurde.
   */
  redirect_uri?: string;
  /**
   * WELCHES Konto gerade verbunden wird (0304). Bei jedem FOLGE-Aufruf
   * mitzugeben — der erste liefert die ID zurück, alle weiteren binden sich
   * damit an denselben Zugang.
   *
   * `neues_konto` allein reicht nicht: es gilt nur für einen Aufruf. Wird der
   * Link erneut angefordert, kommt er ohne das Kennzeichen, und der Server
   * fällt auf den bereits autorisierten Kanal zurück — also auf das ERSTE
   * Konto. Da Channex je Verbindung nur den zuletzt erzeugten `state` kennt,
   * macht schon ein einziger solcher Folge-Aufruf den richtigen Link ungültig.
   */
  account_id?: string | null;
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
        neues_konto: input.neues_konto ?? false,
        redirect_uri: input.redirect_uri,
        account_id: input.account_id ?? null,
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

export type AirbnbUebernahmeResult = {
  created: number;
  updated: number;
  skipped: number;
  // Wie viele Anzeigen das Portal übergeben hat. Airbnb liefert NICHT alle:
  // Anzeigen, die dort schon an eine andere Software gebunden sind (Sync-Status
  // „Connected"), fehlen — ebenso unlisted/snoozed und CoHost-Anzeigen. Die Zahl
  // wird angezeigt, damit ein fehlendes Objekt erklärbar ist.
  listings_gefunden: number;
};

/**
 * Airbnb-Übernahme starten — für den Wechselkunden mit NULL Objekten. Der
 * Server legt das Gerüst-Objekt an, an dem Channex die Autorisierung festmacht,
 * und liefert die echte Airbnb-OAuth-URL zurück. Der Kunde tippt keine Daten.
 */
export async function startAirbnbUebernahme(
  /**
   * Ein WEITERES Airbnb-Konto verbinden (0304). Dann legt der Server einen
   * eigenen Kanal an, statt den vorhandenen wiederzuverwenden.
   */
  neuesKonto = false,
  /** Rücksprung nach der Autorisierung; der Aufrufer kennt die Adresse. */
  redirectUri?: string,
  /**
   * Das Konto aus einem vorherigen Aufruf. Bindet diesen Link an DENSELBEN
   * Zugang, statt den Server erneut wählen zu lassen — ohne diesen Wert griff
   * er zum bereits autorisierten Kanal und schickte den Kunden in den Login des
   * ersten Kontos (live am 07.08.2026 dreimal hintereinander).
   */
  accountId?: string | null,
): Promise<Result<OAuthBeginResult>> {
  const p = new URLSearchParams();
  if (neuesKonto) p.set("neues_konto", "true");
  if (redirectUri) p.set("redirect_uri", redirectUri);
  if (accountId) p.set("account_id", accountId);
  const query = p.toString();
  return call<OAuthBeginResult>(
    `/airbnb/uebernahme/start${query ? `?${query}` : ""}`,
    { method: "POST" },
  );
}

/**
 * Nach dem Autorisieren: die Airbnb-Listings als Objekte übernehmen. Das erste
 * füllt das Gerüst-Objekt, jedes weitere wird ein eigenes Objekt. Idempotent —
 * ein zweiter Aufruf aktualisiert statt zu verdoppeln.
 */
export async function uebernehmeAirbnbListings(
  /**
   * Von WELCHEM Konto übernommen wird (0304). Pflicht, sobald der Betrieb mehr
   * als einen Airbnb-Zugang führt — der Server lehnt dann ohne Angabe ab,
   * statt eines zu raten und die Anzeigen des falschen Vermieters anzulegen.
   */
  accountId?: string | null,
): Promise<Result<AirbnbUebernahmeResult>> {
  const res = await call<AirbnbUebernahmeResult>(
    `/airbnb/uebernahme/listings${accountId ? `?account_id=${accountId}` : ""}`,
    { method: "POST" },
  );
  if (res.ok) revalidatePath("/objekte");
  return res;
}

export type AirbnbObjektAbrufResult = {
  property_id: string;
  listing_id: string;
  waehrung: string | null;
  zeitzone: string | null;
  plan_angelegt: boolean;
  zugeordnet: boolean;
  preis_uebernommen: boolean;
  base_price: number | null;
  min_stay: number | null;
  // Welche weiteren Angaben aus Airbnb übernommen wurden (check_in_from,
  // check_out_until, pets_allowed, pets_max, smoking_allowed, max_nights).
  // Airbnb liefert beim Zuordnen mehr als den Preis.
  uebernommene_felder: string[];
  // Wie viele Fotos NEU aus Airbnb angelegt wurden. Kommt nicht über Channex
  // (dort ist `content.photos` leer), sondern direkt aus `v2/listing_photos`.
  // 0 = keine NEUEN; schon vorhandene werden nicht doppelt angelegt.
  fotos_uebernommen: number;
  // Steht NUR, wenn der Preis NICHT kam — mit dem Grund. Ein leeres Feld bei
  // preis_uebernommen: false wäre eine verschluckte Fehlermeldung.
  hinweis: string | null;
};

/**
 * EIN Objekt bei Airbnb abrufen: zuordnen, dann den Preis holen.
 *
 * Bewusst pro Objekt und nicht für alle — der Betrieb prüft ein Haus, bevor der
 * Rest angefasst wird. Der Abruf macht in einem Zug: Währung/Zeitzone aus dem
 * Land nachtragen, Preisplan sicherstellen, bei Channex zuordnen und den Preis
 * von Airbnb übernehmen (`load_listing_price_settings`).
 */
export async function airbnbObjektAbrufen(
  propertyId: string,
): Promise<Result<AirbnbObjektAbrufResult>> {
  const res = await call<AirbnbObjektAbrufResult>(
    `/properties/${propertyId}/airbnb/abrufen`,
    { method: "POST" },
  );
  if (res.ok) revalidatePath(`/objekte/${propertyId}`);
  return res;
}

// --- Buchungshistorie eines Objekts bei Airbnb -----------------------------
//
// Warum direkt bei Airbnb und nicht über die Portal-Anbindung: die kennt nur,
// was sie selbst als Änderung gesehen hat. Alles, was VOR dem Verbinden
// gebucht wurde, liegt dort nicht (live gemessen: 0 gegenüber 462 bei Airbnb).

/** Eine Etappe des Laufs — die Zeile, die im Fortschritt erscheint. */
export type HistorieEtappe = {
  nummer: number;
  von: string;
  bis: string;
  seiten: number;
  gefunden: number;
  /** Davon in diesem Lauf zum ersten Mal gesehen. Durch die bewusste
   *  Überlappung der Etappen ist `gefunden` meist größer als `neu`. */
  neu: number;
  fehler: string | null;
};

export type HistorieVorschau = {
  property_id: string;
  titel: string | null;
  listing_id: string;
  von: string;
  bis: string;
  etappen: HistorieEtappe[];
  gefunden: number;
  mit_nachrichten: number;
  /** Buchungen anderer Inserate desselben Kontos — werden NICHT angefasst. */
  fremde: number;
  /** false = mindestens eine Etappe ist gescheitert, es FEHLEN Buchungen. */
  vollstaendig: boolean;
  jahre: Record<string, number>;
};

export type HistorieImport = HistorieVorschau & {
  gelesen: number;
  angelegt: number;
  aktualisiert: number;
  uebersprungen: number;
  gruende: string[];
  fehlgeschlagene_etappen: HistorieEtappe[];
};

/** Ergebnis EINER Etappe — die Zeile, die live im Dialog erscheint. */
export type EtappenLauf = {
  nummer: number;
  gesamt: number;
  von: string;
  bis: string;
  gefunden: number;
  neu: number;
  /** Bestätigungscodes dieser Etappe. Der Dialog sammelt sie und schickt sie
   *  als `bekannt` mit, damit die bewusste Überlappung nicht mehrfach zählt. */
  codes: string[];
  jahre: Record<string, number>;
  mit_nachrichten: number;
  fremde: number;
  angelegt: number;
  aktualisiert: number;
  uebersprungen: number;
  gruende: string[];
  fehler: string | null;
};

/** EINE Etappe fahren. `uebernehmen: false` = Vorschau, schreibt nichts. */
export async function airbnbHistorieEtappe(
  propertyId: string,
  von: string,
  bis: string,
  nummer: number,
  uebernehmen: boolean,
  bekannt: string[],
): Promise<Result<EtappenLauf>> {
  const p = new URLSearchParams({
    von,
    bis,
    nummer: String(nummer),
    uebernehmen: String(uebernehmen),
  });
  return call<EtappenLauf>(
    `/properties/${propertyId}/airbnb/historie/etappe?${p.toString()}`,
    { method: "POST", body: { bekannt } },
  );
}

/** Wie viele Etappen ergibt dieser Zeitraum? Ohne Aufruf bei Airbnb. */
export async function airbnbHistoriePlan(
  propertyId: string,
  von: string,
  bis: string,
): Promise<Result<{ etappen: { nummer: string; von: string; bis: string }[] }>> {
  return call(
    `/properties/${propertyId}/airbnb/historie/plan?von=${von}&bis=${bis}`,
  );
}

/** Was liegt im Zeitraum bei Airbnb? Liest nur, schreibt nichts. */
export async function airbnbHistorieVorschau(
  propertyId: string,
  von: string,
  bis: string,
): Promise<Result<HistorieVorschau>> {
  return call(
    `/properties/${propertyId}/airbnb/historie/vorschau?von=${von}&bis=${bis}`,
  );
}

/** Die Historie DIESES Objekts holen und übernehmen. */
export async function airbnbHistorieImportieren(
  propertyId: string,
  von: string,
  bis: string,
): Promise<Result<HistorieImport>> {
  const res = await call<HistorieImport>(
    `/properties/${propertyId}/airbnb/historie/import?von=${von}&bis=${bis}`,
    { method: "POST" },
  );
  if (res.ok) revalidatePath(`/objekte/${propertyId}`);
  return res;
}

/** Ein Objekt, für das der Sammel-Import etwas holen kann. */
export type HistorieObjekt = {
  id: string;
  title: string | null;
  currency: string | null;
  airbnb_listing_id: string | null;
};

/** Objekte mit Anzeigen-Verknüpfung UND aktivem Mapping. Fremde Inserate des
 *  Airbnb-Kontos stehen nicht darin. */
export async function airbnbHistorieObjekte(): Promise<
  Result<{ items: HistorieObjekt[]; anzahl: number }>
> {
  return call("/airbnb/historie/objekte");
}

/** Ein serverseitiger Historien-Lauf. Der Worker schreibt ihn fort, die
 *  Oberfläche liest ihn per Realtime — der Betrieb muss die Seite nicht
 *  offenhalten. */
export type HistorieLauf = {
  id: string;
  status: "laeuft" | "fertig" | "unvollstaendig" | "fehler";
  von: string;
  bis: string;
  objekte_gesamt: number;
  objekte_fertig: number;
  angelegt: number;
  aktualisiert: number;
  uebersprungen: number;
  aktuelles_objekt: string | null;
  gescheitert: { titel: string; grund: string }[];
  fehler: string | null;
  beendet_at: string | null;
};

/** Import serverseitig starten. Antwortet sofort; läuft im Worker weiter.
 *  Läuft schon einer, kommt DIESER zurück statt ein zweiter. */
export async function airbnbHistorieLaufStarten(
  von: string,
  bis: string,
): Promise<Result<HistorieLauf>> {
  return call(`/airbnb/historie/lauf?von=${von}&bis=${bis}`, {
    method: "POST",
  });
}

/** Der jüngste Lauf — damit eine frisch geladene Seite einen noch laufenden
 *  Import erkennt, statt den Knopf anzubieten. */
export async function airbnbHistorieLaufStand(): Promise<
  Result<{ lauf: HistorieLauf | null }>
> {
  return call("/airbnb/historie/lauf");
}

export type HistorieSammelImport = {
  objekte: number;
  erfolgreich: number;
  angelegt: number;
  aktualisiert: number;
  uebersprungen: number;
  /** Objekte, die der Lauf nicht schaffte — namentlich, mit Grund. */
  gescheitert: { property_id: string; titel: string; grund: string }[];
  /** false = es fehlen Buchungen, der Lauf ist zu wiederholen. */
  vollstaendig: boolean;
  ergebnisse: HistorieImport[];
};

/** Die Historie ALLER verbundenen Objekte in EINEM Aufruf holen.
 *
 *  Die Oberfläche nimmt diesen Weg NICHT: sie fährt die Objekte einzeln über
 *  `airbnbHistorieImportieren`, weil ein Lauf über 18 Objekte Minuten dauert
 *  und der Betrieb dabei Fortschritt sehen muss. Dieser Sammel-Aufruf bleibt
 *  für den Weg ohne offenen Browser (geplanter Lauf, Wiederholung nach einem
 *  Abbruch) — er liefert dasselbe Ergebnis, nur ohne Zwischenstände.
 *
 *  Mehrfach aufrufbar: bestehende Buchungen werden über den Bestätigungscode
 *  aktualisiert, nicht doppelt angelegt. */
export async function airbnbHistorieAlleImportieren(
  von: string,
  bis: string,
): Promise<Result<HistorieSammelImport>> {
  const res = await call<HistorieSammelImport>(
    `/airbnb/historie/import-alle?von=${von}&bis=${bis}`,
    { method: "POST" },
  );
  if (res.ok) revalidatePath("/kalender");
  return res;
}

export async function finalizeOAuthChannel(input: {
  property_id: string;
  portal_code: string;
  mappings: ChannelMapping[];
  /** Dasselbe Konto wie beim vorangegangenen `prepareChannel` (0304). */
  account_id?: string | null;
}): Promise<Result<ChannelConnection>> {
  const res = await call<ChannelConnection>(
    `/properties/${input.property_id}/channels/${input.portal_code}/oauth/finalize`,
    {
      method: "POST",
      body: {
        property_id: input.property_id,
        portal_code: input.portal_code,
        mappings: input.mappings,
        account_id: input.account_id ?? null,
      },
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
  /** Zimmer/Einheit beim Portal — zusammen mit hotel_id die Angabe, mit der
   *  man im Extranet des Portals nachsieht. */
  ota_room_type_code: string | null;
  ota_room_title: string | null;
  channel_id: string | null;
  is_active: boolean;
  /** Sync-Stand des Objekts (gilt für alle Portale dieses Objekts). */
  sync_enabled: boolean;
  last_sync_status: string | null;
  last_sync_error: string | null;
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

/** Sync-Stand EINES Postens (Gebühr/Steuer) über alle verbundenen Portale.
 *
 *  Drei getrennte Aussagen, weil sie verschiedene Dinge bedeuten:
 *  `manual_portals` = dort nimmt das Portal den Posten nicht, er muss im
 *  Extranet gepflegt werden (Chip „Manuelle Synchronisierung");
 *  `restricted_portals` = der Betrieb hat ihn selbst ausgeschlossen;
 *  `internal_only` = er geht bewusst an kein Portal (optionale Gebühr, Kaution). */
export type AbgabePostenStatus = {
  key: string;
  kind: "fee" | "tax" | "promotion";
  manual_portals: string[];
  restricted_portals: string[];
  internal_only: boolean;
  /** Nur bei Promotions: warum der TAGESPREIS die Aktion nicht tragen kann
   *  (Schlüssel, kein Satz — die Oberfläche übersetzt ihn). Gilt für alle
   *  Portale außer Airbnb. */
  reason?: string | null;
  /** Nur bei Promotions: warum AIRBNB sie auch nicht über die eigene
   *  Rabattregel bekommt. Getrennt, weil es ein anderer Weg mit anderen Grenzen
   *  ist — ein gemeinsamer Grund wäre für ein Portal immer falsch. */
  airbnb_reason?: string | null;
  /** ZURÜCKGELESENER Stand beim Portal — was dort wirklich steht, nicht was
   *  gesendet wird. Getrenntes Feld, weil es eine Aussage anderer Art ist:
   *  `manual_portals` sagt „geht dorthin gar nicht", `live` sagt „dort steht
   *  gerade dieser Betrag". Leer = noch nie geprüft (heute nur Airbnb hat
   *  einen Leseweg für Gebühren). */
  live?: AbgabeLiveStand[];
  /** Portale, die diese Gebührenart in einer ECHTEN Buchung dem Gast berechnet
   *  haben. Die stärkste der Aussagen — kein Regelschluss, sondern ein
   *  Zahlungsvorgang. Nur bei `kind: "fee"` gefüllt; Steuern haben keine
   *  Gebührenart, an der ein Beleg hängen könnte.
   *
   *  Leer heißt „kein Beleg", NICHT „liegt dort nicht": ein Objekt ohne
   *  Buchungen kann keinen haben. Die Oberfläche muss beides unterscheiden,
   *  sonst behauptet sie für ein neues Inserat, dort läge nichts. */
  belegt_bei_portalen?: string[];
};

/** Ein zurückgelesener Portal-Stand eines Postens (`ota_gebuehren_stand`). */
export type AbgabeLiveStand = {
  portal: string;
  /** online = dort steht unser Betrag · abweichend = ein anderer · fehlt = keiner */
  status: "online" | "abweichend" | "fehlt";
  /** Betrag, den das Portal trägt. null bei `fehlt` (kein 0-Ersatz). */
  amount: number | null;
  expected: number | null;
  currency: string | null;
  checked_at: string | null;
};

/** Welche Abgabe kommt bei welchem verbundenen Portal wirklich an?
 *
 *  Gerechnet aus derselben Quelle, aus der der Sync sendet — die Oberfläche
 *  führt KEINE eigene Regeltabelle, sonst behauptete der Chip „geht raus", wo
 *  der Sync den Posten wegließe. */
export async function getAbgabenStatus(propertyId: string): Promise<
  Result<{
    currency_missing: boolean;
    portals: string[];
    items: AbgabePostenStatus[];
  }>
> {
  return call(`/properties/${propertyId}/abgaben-status`);
}

/* Kein `pruefeGebuehrenStand` mehr: der Knopf „Beim Portal prüfen" ist am
   12.08.2026 aus der Preise-Maske entfernt worden, mit ihm die Route. Der
   Ist-Stand kommt weiter aus `getAbgabenStatus` (Feld `live` je Posten) und wird
   vom Hintergrund-Job gepflegt — Channex reicht asynchron weiter, ein Klick
   konnte darum nur den alten Stand erneut bestätigen. */

/** Ein Tarifplan dieses Objekts, wie er ans Portal geht (Lodgify: „Aktive
 *  Tarifpläne"): Kondition, Name/Typ, Preisänderung. offset_* nur bei
 *  abgeleiteten Plänen. */
export type ChannelRatePlanRow = {
  id: string;
  name: string | null;
  base_price: number | null;
  currency: string | null;
  min_stay: number | null;
  rate_mode: string | null;
  offset_amount: number | null;
  offset_percent: number | null;
  condition: string | null;
  send_to_portals: boolean;
  /** Grundpreis-Plan (älteste Channex-Zuordnung): geht IMMER ans Portal —
   *  send_to_portals schaltet nur ZUSÄTZLICHE Pläne frei. */
  is_primary: boolean;
};

export type ChannelPropertyDetail = {
  portal_code: string;
  portal: string;
  property_id: string;
  property_title: string | null;
  currency: string | null;
  hotel_id: string | null;
  ota_room_type_code: string | null;
  ota_room_title: string | null;
  channel_id: string | null;
  is_active: boolean;
  last_error: string | null;
  updated_at: string | null;
  map_id: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  property_photo: string | null;
  rate_plans: ChannelRatePlanRow[];
  /** Dynamic Pricing aktiv: ans Portal gehen die dynamischen Tagespreise,
   *  base_price ist nur der Anker der Berechnung. */
  dynamic_pricing_enabled: boolean;
  /** Preisänderung dieses Portals in % (Kanal-Plan-Offset); 0 = keine. */
  price_adjustment_percent: number;
  /** Airbnb-Steuererhebung dieses Inserats (nur bei Airbnb gepflegt). */
  airbnb_tax_scenario: AirbnbTaxScenario | null;
  airbnb_tax_acknowledged: boolean;
  airbnb_send_user_taxes: boolean;
};

/** Was AIRBNB selbst mit den Steuern tut — nicht, was wir wollen.
 *  `ineligible`: Airbnb erhebt automatisch bzw. unterstützt keine
 *  Beherbergungssteuern, ein Export ist unmöglich. `no_collected`: Airbnb erhebt
 *  nichts. `stacked`: Airbnb erhebt, unsere Werte kommen obendrauf. */
export type AirbnbTaxScenario = "ineligible" | "no_collected" | "stacked";

/** Airbnb-Steuererhebung setzen. Erst wenn Szenario, Bestätigung und Schalter
 *  zusammenpassen, gehen eigene Steuern an Airbnb; der Server erzwingt die
 *  Abhängigkeiten erneut und stößt den Steuer-Sync an. */
export async function setAirbnbTaxSettings(
  propertyId: string,
  portalCode: string,
  req: {
    scenario: AirbnbTaxScenario | null;
    acknowledged: boolean;
    send_user_taxes: boolean;
  },
): Promise<Result<{ airbnb_send_user_taxes: boolean }>> {
  return call<{ airbnb_send_user_taxes: boolean }>(
    `/properties/${propertyId}/connections/${portalCode}/airbnb-tax`,
    { method: "PUT", body: req },
  );
}

/** Preisänderung je Portal setzen (Lodgify-Modell): %-Aufschlag auf die
 *  effektive Tageskurve GENAU DIESES Portals; 0 entfernt den Aufschlag. */
export async function setPortalPriceAdjustment(
  propertyId: string,
  portalCode: string,
  percent: number,
): Promise<Result<{ portal_code: string; percent: number }>> {
  return call<{ portal_code: string; percent: number }>(
    `/properties/${propertyId}/connections/${portalCode}/price-adjustment`,
    { method: "PUT", body: { percent } },
  );
}

export async function channelPropertyDetail(
  propertyId: string,
  portalCode: string,
): Promise<Result<ChannelPropertyDetail>> {
  return call<ChannelPropertyDetail>(
    `/properties/${propertyId}/connections/${portalCode}`,
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

/** Ein Objekt von EINEM Portal trennen — eine falsche Zuordnung lösen.
 *
 *  Nicht zu verwechseln mit `setConnectionActive(false)`: das PAUSIERT nur
 *  (Kanal und Zuordnung bleiben), womit sich eine falsch zugeordnete Anzeige
 *  nicht korrigieren lässt. Und nicht mit `disconnectProperty`: das trennt das
 *  Objekt von allen Portalen. */
export async function disconnectPortalConnection(
  propertyId: string,
  portalCode: string,
): Promise<Result<StoredChannelConnection>> {
  const res = await call<StoredChannelConnection>(
    `/properties/${propertyId}/connections/${portalCode}`,
    { method: "DELETE" },
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

// --- Kanal-Ereignisse (Airbnb-Anfragen, Sync-Fehler, Reviews, Kanalwechsel) ---
//
// Die Ereignisse kommen als Webhook von den Portalen herein und liegen in
// `channex_webhook_event`. Sie sind der einzige Weg, auf dem der Betrieb von
// einem Sync-Fehler oder einer fristgebundenen Airbnb-Anfrage erfährt —
// ohne diese Ansicht laufen sie ins Leere.

export type KanalEreignis = {
  id: string;
  property_id: string | null;
  event: string;
  payload: Record<string, unknown> | unknown[] | null;
  /** error | action | info — bestimmt Dringlichkeit und Darstellung. */
  severity: string;
  resolved: boolean;
  created_at: string | null;
  /** Ohne diese ID ist eine Airbnb-Anfrage nicht beantwortbar. */
  live_feed_event_id: string | null;
  resolution: Record<string, unknown> | null;
  resolved_at: string | null;
};

/** Die letzten Kanal-Ereignisse, neueste zuerst. */
export async function listKanalEreignisse(
  nurOffene = false,
  limit = 100,
): Promise<Result<KanalEreignis[]>> {
  const p = new URLSearchParams({ limit: String(limit) });
  if (nurOffene) p.set("only_unresolved", "true");
  return call<KanalEreignis[]>(`/events?${p}`);
}

/** Ein Ereignis lokal abhaken („gesehen, kümmert sich jemand").
 *
 *  ACHTUNG: das ist NICHT die Antwort an Airbnb — eine Anfrage bleibt beim
 *  Portal offen, bis sie dort beantwortet wird. Die Oberfläche muss diesen
 *  Unterschied benennen, sonst hält der Betrieb etwas für erledigt, während
 *  der Gast weiter wartet. */
export async function kanalEreignisAbhaken(
  eventId: string,
): Promise<Result<null>> {
  const res = await call<null>(`/events/${eventId}/resolve`, { method: "POST" });
  if (res.ok) revalidatePath("/channels/ereignisse");
  return res;
}
