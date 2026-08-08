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

// --- Backoffice-Team ---------------------------------------------------------

export type PlatformRole = "platform_admin" | "platform_support";

export interface TeamMember {
  user_id: string;
  email: string | null;
  platform_role: PlatformRole;
  active: boolean;
  note: string | null;
  created_at: string;
  granted_by_email: string | null;
  last_sign_in_at: string | null;
  /** Eingeladen, aber Passwort noch nicht gesetzt. */
  invite_pending: boolean;
  invite_expires_at: string | null;
}

export interface TeamList {
  items: TeamMember[];
  total: number;
}

export interface TeamInviteResult {
  member: TeamMember;
  /** 'freigeschaltet' (Konto existierte) oder 'eingeladen' (neu + Link). */
  ergebnis: string;
  mail_versendet: boolean;
  /** Nur gesetzt, wenn die Mail NICHT rausging — dann selbst weitergeben. */
  invite_link: string | null;
  hinweis: string | null;
}

export type TicketStatus = "open" | "waiting" | "resolved" | "closed";

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_kind: "reporter" | "agent";
  author_user_id: string | null;
  body: string;
  internal: boolean;
  created_at: string;
  client_msg_id: string | null;
}

export interface SupportTicket {
  id: string;
  reporter_user_id: string | null;
  reporter_guest_id: string | null;
  /** Anonymer Melder von der Marketing-Seite (source='web'): kein Konto, die
   *  Kontaktdaten hängen am Ticket. */
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
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
  /** 'chat' = Live-Chat aus dem Dashboard des Betriebs, 'form' = Formular,
   *  'web' = anonyme Anfrage aus dem Widget der Marketing-Seite. */
  source: "form" | "chat" | "web";
  last_message_preview: string | null;
  last_message_kind: "reporter" | "agent" | null;
  agent_last_read_at: string | null;
  /** Ungelesene Nachrichten des Melders (Team-Sicht). */
  unread: number;
  rating: number | null;
  rating_comment: string | null;
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
  source?: "form" | "chat" | "web";
  /** Nur mir zugewiesene Konversationen. */
  mine?: boolean;
  limit?: number;
  offset?: number;
}): Promise<SupportTicketList> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status_filter", params.status);
  if (params?.source) q.set("source", params.source);
  if (params?.mine) q.set("mine", "true");
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

// --- Buchungen --------------------------------------------------------------

export interface BuchungSummary {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  property_id: string;
  property_title: string | null;
  guest_name: string | null;
  channel: string;
  status: string;
  payment_status: string;
  check_in: string;
  check_out: string;
  naechte: number;
  total_amount: string;
  paid_amount: string;
  currency: string | null;
  created_at: string;
}

export interface BuchungList {
  items: BuchungSummary[];
  total: number;
}

export interface BuchungGast {
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string | null;
  guest_id: string | null;
  name: string | null;
  company: string | null;
  stays_count: number | null;
  portal_guest_id: string | null;
  portal_registered_at: string | null;
}

export interface BuchungObjekt {
  id: string;
  title: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  status: string | null;
  max_guests: number | null;
}

export interface BuchungZahlung {
  id: string;
  type: string | null;
  status: string | null;
  gateway: string | null;
  amount: string | null;
  currency: string | null;
  due_at: string | null;
  created_at: string;
}

export interface BuchungProvision {
  id: string;
  fee_bps: number | null;
  gross_amount_cents: number | null;
  fee_amount_cents: number | null;
  reversed_amount_cents: number | null;
  currency: string | null;
  gateway: string | null;
  status: string | null;
  created_at: string;
}

export interface BuchungDetail extends BuchungSummary {
  gast: BuchungGast;
  objekt: BuchungObjekt;
  zahlungen: BuchungZahlung[];
  provisionen: BuchungProvision[];
  quote_items: Record<string, unknown>[];
  num_guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  note: string | null;
  ota_name: string | null;
  external_ref: string | null;
  source_channex_booking_id: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  channel_fee: string;
}

/** Alle Buchungen der Plattform (neueste zuerst). */
export async function getBuchungen(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  channel?: string;
  tenantId?: string;
  suche?: string;
}): Promise<BuchungList> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.status) q.set("status_filter", params.status);
  if (params?.channel) q.set("channel", params.channel);
  if (params?.tenantId) q.set("tenant_id", params.tenantId);
  if (params?.suche) q.set("suche", params.suche);
  const suffix = q.toString() ? `?${q}` : "";
  return api<BuchungList>(`/platform/buchungen${suffix}`, { cache: "no-store" });
}

/** Eine Buchung mit beiden Seiten: Betrieb/Objekt und Gast/Zahlung. */
export async function getBuchung(id: string): Promise<BuchungDetail> {
  return api<BuchungDetail>(`/platform/buchungen/${id}`, { cache: "no-store" });
}

// --- Steuer-Compliance ------------------------------------------------------
//
// Der Betreiber MUSS überprüfen können, ob die Steuerangaben seiner Betriebe
// vollständig sind: das Unterlassen der Durchsetzung ist nach § 25 Abs. 1
// Nr. 6 PStTG mit bis zu 30.000 € bußgeldbewehrt.

export interface SteuerBetrieb {
  tenant_id: string;
  tenant_name: string | null;
  country: string | null;
  /** Länder, in denen der Betrieb ansässig ist ODER Objekte hat. */
  pflicht_laender: string[];
  erfasste_laender: string[];
  fehlende_laender: string[];
  objekte_gesamt: number;
  /** Ohne erhobene Grundbuchnummer (§ 14 Abs. 4 Nr. 6). */
  objekte_ohne_angabe: number;
  mahnungen_offen: number;
  zahlungen_einbehalten: boolean;
  /** 180-Tage-Frist verstrichen, ohne dass eine Maßnahme lief. */
  ueberfaellig: string[];
}

export interface SteuerUebersicht {
  betriebe: SteuerBetrieb[];
  betriebe_gesamt: number;
  betriebe_vollstaendig: number;
  betriebe_mit_luecke: number;
  betriebe_ueberfaellig: number;
  zahlungen_einbehalten: number;
}

/** Steuerlicher Stand aller Betriebe (neueste zuerst). */
export async function getSteuern(nurLuecken = false): Promise<SteuerUebersicht> {
  const q = nurLuecken ? "?nur_luecken=true" : "";
  return api<SteuerUebersicht>(`/platform/steuern${q}`, { cache: "no-store" });
}

// --- Deploy-Monitor ---------------------------------------------------------
// Quelle ist Coolify (über FastAPI), nicht unsere Datenbank. Deshalb gibt es
// hier auch kein Realtime: es existiert keine Tabelle, die man abonnieren
// könnte — die Seite aktualisiert sich stattdessen im Takt (siehe Seite).

export interface DeployEintrag {
  id: number | null;
  deployment_uuid: string | null;
  anwendung: string;
  anwendung_uuid: string | null;
  status: string;
  commit: string | null;
  commit_nachricht: string | null;
  gestartet_at: string | null;
  beendet_at: string | null;
  log_url: string | null;
}

/** Ein Commit auf `main`, der diese Anwendung betrifft und noch nicht live ist. */
export interface OffenerCommit {
  sha: string;
  kurz_sha: string;
  nachricht: string;
  autor: string | null;
  zeitpunkt: string | null;
  /** Nur die Dateien, die unter den watch_paths DIESER App liegen. */
  dateien: string[];
}

export interface DeployRueckstand {
  /** null = nicht ermittelbar (kein GitHub-Zugang). Nicht 0 — das hieße „aktuell". */
  commits_gesamt: number | null;
  commits_relevant: number | null;
  betrifft_mich: boolean;
  offene: OffenerCommit[];
  fehler: string | null;
}

export interface DeployApp {
  uuid: string;
  name: string;
  laeuft: boolean;
  letzter: DeployEintrag | null;
  rueckstand: DeployRueckstand | null;
}

export interface DeployUebersicht {
  apps: DeployApp[];
  aktiv: boolean;
  main_sha: string | null;
  main_kurz_sha: string | null;
}

export interface DeployVerlauf {
  items: DeployEintrag[];
}

/** Laufender bzw. letzter Deploy je überwachter Anwendung. */
export async function getDeployUebersicht(): Promise<DeployUebersicht> {
  return api<DeployUebersicht>("/platform/deploy", { cache: "no-store" });
}

/** Die letzten Deploys EINER Anwendung, neueste zuerst. */
export async function getDeployVerlauf(
  anwendungUuid: string,
  limit = 20,
): Promise<DeployVerlauf> {
  return api<DeployVerlauf>(
    `/platform/deploy/${anwendungUuid}?limit=${limit}`,
    { cache: "no-store" },
  );
}

export interface DeployLogZeile {
  text: string;
  art: string;
  zeit: string | null;
}

export interface DeployLog {
  deployment_uuid: string;
  status: string;
  zeilen: DeployLogZeile[];
}

/** Das Build-Log EINES Deploys — im Backoffice, ohne Coolify-Zugang. */
export async function getDeployLog(deploymentUuid: string): Promise<DeployLog> {
  return api<DeployLog>(`/platform/deploy/log/${deploymentUuid}`, {
    cache: "no-store",
  });
}
