// Lesezugriffe des Partner-Dashboards (/affiliates/*). Jeder Endpunkt ist
// serverseitig auf die eigene affiliate_id gescopet; diese Datei ist Transport.
import type { SocialKanal } from "./kanaele";
import { ApiError, api } from "./api-server";

export type PartnerStatus = "pending_review" | "approved" | "rejected" | "suspended";

export interface Rang {
  id: string;
  name: string;
  /** Schwellen der STRUKTUR-Kundenzahl (eigene + Team-Kunden, 0525). */
  min_customers: number;
  max_customers: number | null;
  rate: string;
  /** Außer Dienst (0525) — Team-Provision ist die Differenz der Sätze. Immer "0". */
  override_rate: string;
  /** Superprovision als Faktor ("0.025" ab Elite), ohne Laufzeitgrenze. */
  lifetime_rate: string;
  /** Darf dieser Rang Team-Partner führen? */
  team_allowed: boolean;
  /** Einmaliger Aufstiegsbonus beim Erreichen, je Währung. */
  bonus: Betrag[];
}

export interface Betrag {
  amount: string;
  currency: string;
}

export interface ConnectStand {
  verbunden: boolean;
  stripe_account_id: string | null;
  auszahlbar: boolean;
  daten_vollstaendig: boolean;
  /** Offene Stripe-Anforderungen (`currently_due`) — zeigt, WORAN es hängt. */
  offene_felder: string[];
  gesperrt_grund: string | null;
}

export interface ConnectPflichtfelder {
  minimum: string[];
  zusaetzlich: string[];
}

export interface Profil {
  affiliate_id: string;
  email: string;
  full_name: string;
  company: string | null;
  legal_form: "company" | "private";
  country: string;
  vat_id: string | null;
  vat_id_verified: boolean;
  language: string;
  channel_url: string | null;
  channels: SocialKanal[];
  sponsor_name: string | null;
  team_size: number;
  status: PartnerStatus;
  status_reason: string | null;
  tier: Rang;
  payout_method: "wise" | "sepa" | "paypal" | "stripe" | null;
  payout_details_masked: string | null;
  /** Verbundkonto (0522) — einziger Auszahlungsweg. */
  connect: ConnectStand;
  terms_version: string | null;
  created_at: string;
}

export interface Code {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  url: string | null;
  tracking_url: string | null;
  clicks_30d: number;
  created_at: string;
}

export interface Dashboard {
  status: PartnerStatus;
  tier: Rang;
  next_tier: { tier: Rang; missing_customers: number } | null;
  kennzahlen: {
    clicks_30d: number;
    registrations: number;
    paying_customers: number;
    pending: Betrag[];
    approved: Betrag[];
    paid: Betrag[];
  team_size: number;
  team_override: Betrag[];
  /** Struktur (0525): eigene + Team-Kunden — die Zahl, die den Rang bestimmt. */
  structure_customers: number;
  lifetime: Betrag[];
  booking_share: Betrag[];
  bonus: Betrag[];
  };
  codes: Code[];
}

export interface Kunde {
  id: string;
  label: string;
  country: string | null;
  status: "registriert" | "zahlend" | "beendet" | "in_pruefung" | "abgelehnt";
  registered_at: string;
  first_paid_at: string | null;
  commission_until: string | null;
  earned: Betrag[];
}

export interface Provision {
  id: string;
  customer_label: string;
  kind: ProvisionsArt;
  source_partner_name: string | null;
  amount: string;
  currency: string;
  base_amount: string;
  rate: string;
  tier_id: string;
  status: string;
  period: string | null;
  matures_at: string | null;
  created_at: string;
}

export interface Auszahlung {
  id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  period_from: string | null;
  period_to: string | null;
  statement_no: string | null;
  external_ref: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Material {
  id: string;
  kind: "video" | "image" | "text" | "link";
  title: string;
  description: string | null;
  language: string | null;
  url: string | null;
  body: string | null;
}

/** Eigenes Profil — null, wenn keine (gültige) Sitzung. Der Server prüft
 *  Token und Partner-Status frisch (Wurzel 7). */
export async function getMe(): Promise<Profil | null> {
  try {
    return await api<Profil>("/affiliates/me");
  } catch (exc) {
    if (exc instanceof ApiError && (exc.status === 401 || exc.status === 403)) return null;
    throw exc;
  }
}

export const getDashboard = () => api<Dashboard>("/affiliates/dashboard");
export const getKunden = () => api<{ items: Kunde[]; total: number }>("/affiliates/customers?limit=200");
export const getProvisionen = () =>
  api<{ items: Provision[]; total: number }>("/affiliates/commissions?limit=200");
export const getAuszahlungen = () =>
  api<{ items: Auszahlung[]; total: number }>("/affiliates/payouts?limit=100");
export const getCodes = () => api<Code[]>("/affiliates/codes");
export const getMaterial = () => api<Material[]>("/affiliates/assets");
export const getRaenge = () => api<Rang[]>("/affiliates/tiers", { isPublic: true });

// --- Team (0520) --------------------------------------------------------------
export type ProvisionsArt =
  | "earn"
  | "reversal"
  | "adjustment"
  | "override"
  | "bonus"
  | "lifetime"
  | "booking_share";

export interface TeamMitglied {
  affiliate_id: string;
  name: string;
  company: string | null;
  status: PartnerStatus;
  tier: Rang;
  joined_at: string | null;
  paying_customers: number;
  revenue_30d: Betrag[];
  revenue_total: Betrag[];
  override_pending: Betrag[];
  override_approved: Betrag[];
  override_paid: Betrag[];
  flags: string[];
}

export interface TeamMonat {
  month: string;
  override: Betrag[];
  revenue: Betrag[];
}

export interface Team {
  /** Nur gesetzt, wenn der eigene Rang Team-Partner führen darf. */
  team_link: string | null;
  team_allowed: boolean;
  /** Eigener Satz — die Team-Provision ist die Differenz dazu (0525). */
  own_rate: string;
  members: TeamMitglied[];
  members_active: number;
  team_customers: number;
  revenue_30d: Betrag[];
  override_pending: Betrag[];
  override_approved: Betrag[];
  override_paid: Betrag[];
  months: TeamMonat[];
  sponsor: { affiliate_id: string; name: string; company: string | null; joined_at: string | null } | null;
}

export interface TeamThread {
  id: string;
  partner_id: string;
  partner_name: string;
  role: "sponsor" | "member";
  last_message_at: string | null;
  unread: number;
}

export interface TeamNachricht {
  id: string;
  thread_id: string;
  sender_affiliate_id: string;
  mine: boolean;
  body: string;
  created_at: string;
}

export async function getTeam(): Promise<Team> {
  return api<Team>("/affiliates/team", { cache: "no-store" });
}

export async function getTeamThreads(): Promise<TeamThread[]> {
  return api<TeamThread[]>("/affiliates/team/threads", { cache: "no-store" });
}

export async function getTeamNachrichten(threadId: string): Promise<TeamNachricht[]> {
  return api<TeamNachricht[]>(`/affiliates/team/threads/${threadId}/messages`, { cache: "no-store" });
}

/** Stand des Verbundkontos — LIVE bei Stripe nachgelesen (nicht der Spiegel). */
export async function getConnect(): Promise<ConnectStand> {
  return api<ConnectStand>("/affiliates/me/connect");
}

/** Pflichtfelder für Land und Rechtsform dieses Partners, live aus Stripe. */
export async function getConnectPflichtfelder(): Promise<ConnectPflichtfelder> {
  return api<ConnectPflichtfelder>("/affiliates/me/connect/requirements");
}
