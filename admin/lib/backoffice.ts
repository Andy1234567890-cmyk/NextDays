// Lesezugriffe des Backoffice auf die /platform/*-Endpunkte.
// Jeder dieser Endpunkte ist serverseitig durch CurrentPlatformAdmin bewacht
// (DB-geprüfte Rolle); diese Datei ist reiner Transport.
import { api } from "./api-server";

export interface PlatformMe {
  user_id: string;
  email: string | null;
  platform_role: "platform_admin" | "platform_support";
  /** true nur bei platform_admin — steuert die Sichtbarkeit von Aktionen. */
  can_write: boolean;
}

export interface AuditEntry {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  tenant_id: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export interface AuditList {
  items: AuditEntry[];
  total: number;
}

/** Identität + Rolle des eingeloggten Backoffice-Nutzers. */
export async function getPlatformMe(): Promise<PlatformMe> {
  return api<PlatformMe>("/platform/me", { cache: "no-store" });
}

/** Backoffice-Protokoll (neueste zuerst). */
export async function getAudit(params?: {
  limit?: number;
  offset?: number;
  action?: string;
  tenantId?: string;
}): Promise<AuditList> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.action) q.set("action", params.action);
  if (params?.tenantId) q.set("tenant_id", params.tenantId);
  const suffix = q.toString() ? `?${q}` : "";
  return api<AuditList>(`/platform/audit${suffix}`, { cache: "no-store" });
}

// --- Betriebe ---------------------------------------------------------------

export interface TenantSummary {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  account_type: string | null;
  business_type: string | null;
  created_at: string;
  property_count: number;
  active_property_count: number;
  user_count: number;
}

export interface TenantDetail extends TenantSummary {
  stripe_charges_enabled: boolean;
  stripe_account_id: string | null;
  subscription_status: string | null;
}

export interface TenantList {
  items: TenantSummary[];
  total: number;
}

/** Alle Betriebe der Plattform (neueste zuerst). */
export async function getTenants(params?: {
  limit?: number;
  offset?: number;
  suche?: string;
}): Promise<TenantList> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.suche) q.set("suche", params.suche);
  const suffix = q.toString() ? `?${q}` : "";
  return api<TenantList>(`/platform/tenants${suffix}`, { cache: "no-store" });
}

/** Ein Betrieb im Detail inkl. Zahlungs-/Abo-Status. */
export async function getTenant(id: string): Promise<TenantDetail> {
  return api<TenantDetail>(`/platform/tenants/${id}`, { cache: "no-store" });
}

// --- Registrierungen --------------------------------------------------------

export interface PlatformUser {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string;
}

export interface PlatformUserList {
  items: PlatformUser[];
  total: number;
}

export interface PlatformGuest {
  id: string;
  email: string | null;
  name: string | null;
  preferred_locale: string | null;
  preferred_currency: string | null;
  marketing_opt_in: boolean | null;
  created_at: string;
}

export interface PlatformGuestList {
  items: PlatformGuest[];
  total: number;
}

/** Betriebs-Nutzer (Supply-Seite). */
export async function getUsers(params?: {
  limit?: number;
  offset?: number;
  tenantId?: string;
}): Promise<PlatformUserList> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.tenantId) q.set("tenant_id", params.tenantId);
  const suffix = q.toString() ? `?${q}` : "";
  return api<PlatformUserList>(`/platform/users${suffix}`, { cache: "no-store" });
}

/** Plattform-Gäste (Demand-Seite, portal_guests). */
export async function getGuests(params?: {
  limit?: number;
  offset?: number;
  suche?: string;
}): Promise<PlatformGuestList> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.suche) q.set("suche", params.suche);
  const suffix = q.toString() ? `?${q}` : "";
  return api<PlatformGuestList>(`/platform/guests${suffix}`, { cache: "no-store" });
}

// --- Objekt-Freigabe (Marktplatz) -------------------------------------------

export type ModerationStatus = "draft" | "pending" | "approved" | "rejected";

export interface ModerationProperty {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  title: string;
  city: string | null;
  country: string | null;
  status: string;
  moderation_status: ModerationStatus;
  moderation_note: string | null;
  moderation_submitted_at: string | null;
  moderation_reviewed_at: string | null;
  photos: string[];
  max_guests: number | null;
  currency: string | null;
}

export interface ModerationList {
  items: ModerationProperty[];
  total: number;
}

/** Freigabe-Warteschlange (Standard: wartende, älteste zuerst). */
export async function getModerationQueue(params?: {
  status?: ModerationStatus;
  limit?: number;
  offset?: number;
}): Promise<ModerationList> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status_filter", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const suffix = q.toString() ? `?${q}` : "";
  return api<ModerationList>(`/platform/moderation${suffix}`, {
    cache: "no-store",
  });
}

// --- Stripe & Finanzen ------------------------------------------------------

export interface FinanzKennzahlen {
  currency: string;
  gross_amount_cents: number;
  fee_amount_cents: number;
  reversed_amount_cents: number;
  fee_count: number;
}

export interface PlatformFeeRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  reservation_id: string | null;
  fee_bps: number | null;
  gross_amount_cents: number | null;
  fee_amount_cents: number | null;
  reversed_amount_cents: number | null;
  currency: string | null;
  gateway: string | null;
  status: string | null;
  created_at: string;
}

export interface FinanzUebersicht {
  kennzahlen: FinanzKennzahlen[];
  letzte: PlatformFeeRow[];
  tenants_ohne_zahlung: number;
  abos: Record<string, number>;
}

/** Finanzsicht: Provisionen je Währung, jüngste Buchungen, Onboarding-Rückstand. */
export async function getFinanzen(limit = 50): Promise<FinanzUebersicht> {
  return api<FinanzUebersicht>(`/platform/finanzen?limit=${limit}`, {
    cache: "no-store",
  });
}

// --- Support ----------------------------------------------------------------

export type TicketStatus = "open" | "waiting" | "resolved" | "closed";

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_kind: "reporter" | "agent";
  author_user_id: string | null;
  body: string;
  internal: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  reporter_user_id: string | null;
  reporter_guest_id: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  subject: string;
  category: string | null;
  status: TicketStatus;
  priority: "low" | "normal" | "high" | "urgent";
  assignee_user_id: string | null;
  reservation_id: string | null;
  property_id: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

export interface SupportTicketList {
  items: SupportTicket[];
  total: number;
}

/** Support-Tickets, zuletzt aktive zuerst. */
export async function getTickets(params?: {
  status?: TicketStatus;
  limit?: number;
  offset?: number;
}): Promise<SupportTicketList> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status_filter", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const suffix = q.toString() ? `?${q}` : "";
  return api<SupportTicketList>(`/platform/support${suffix}`, {
    cache: "no-store",
  });
}

/** Ein Ticket mit vollem Verlauf (inkl. interner Notizen). */
export async function getTicket(id: string): Promise<SupportTicketDetail> {
  return api<SupportTicketDetail>(`/platform/support/${id}`, {
    cache: "no-store",
  });
}

// --- Technische Diagnose (nur bei Freigabe des Kunden) ----------------------

export interface DebugSession {
  id: string;
  tenant_id: string | null;
  ticket_id: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  note: string | null;
  aktiv: boolean;
}

export interface DiagnosticRow {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  app: string;
  // Die ersten vier laufen dauerhaft (rein technisch). navigation/aktion/aufruf
  // sind einwilligungspflichtig und existieren nur bei aktiver Freigabe.
  kind:
    | "error"
    | "api_error"
    | "slow_request"
    | "client_info"
    | "navigation"
    | "aktion"
    | "aufruf";
  message: string;
  path: string | null;
  http_status: number | null;
  duration_ms: number | null;
  context: Record<string, unknown>;
  created_at: string;
}

export interface DiagnosticList {
  items: DiagnosticRow[];
  total: number;
}

/** Laufende Diagnose-Freigaben — nur Konten, die aktiv Einsicht gewähren. */
export async function getDebugSessions(): Promise<DebugSession[]> {
  return api<DebugSession[]>("/platform/diagnostics/sessions", {
    cache: "no-store",
  });
}

/** Technische Ereignisse einer Freigabe. Leer, sobald sie abgelaufen ist. */
export async function getSessionEvents(
  sessionId: string,
): Promise<DiagnosticList> {
  return api<DiagnosticList>(
    `/platform/diagnostics/sessions/${sessionId}`,
    { cache: "no-store" },
  );
}

// --- Vorgangshistorie eines Betriebs ----------------------------------------

export interface VorgangEintrag {
  quelle: "reservierung" | "stornierung" | "anmeldung" | "zuweisung";
  art: string;
  beschreibung: string;
  user_id: string | null;
  user_email: string | null;
  ziel_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

/** Fachliche Vorgänge eines Betriebs (neueste zuerst). */
export async function getVorgaenge(
  tenantId: string,
): Promise<{ items: VorgangEintrag[] }> {
  return api<{ items: VorgangEintrag[] }>(
    `/platform/tenants/${tenantId}/vorgaenge?limit=100`,
    { cache: "no-store" },
  );
}
