// Lesezugriffe des Backoffice auf das Partnerprogramm (/platform/affiliates/*).
// Jeder Endpunkt ist serverseitig durch CurrentPlatformAdmin bewacht und
// protokolliert (auch lesend); diese Datei ist reiner Transport.
import type { Plattform, SocialKanal } from "./kanaele";
import { api } from "./api-server";

export type PartnerStatus = "pending_review" | "approved" | "rejected" | "suspended";

export interface Partner {
  id: string;
  email: string;
  full_name: string;
  company: string | null;
  legal_form: "company" | "private";
  country: string;
  vat_id: string | null;
  vat_id_verified_at: string | null;
  language: string;
  channel_url: string | null;
  channels: SocialKanal[];
  pitch: string | null;
  status: PartnerStatus;
  status_reason: string | null;
  current_tier_id: string;
  payout_method: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  referrals: number;
  paying_customers: number;
  clicks_30d: number;
  reach: number;
  sponsor_affiliate_id: string | null;
  sponsor_name: string | null;
  sponsor_joined_at: string | null;
  sponsor_flags: string[];
  team_size: number;
}

export interface PartnerListe {
  items: Partner[];
  total: number;
}

export interface PartnerCode {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  url: string | null;
  tracking_url: string | null;
  clicks_30d: number;
  created_at: string;
}

export interface PartnerDetail {
  partner: Partner;
  payout_details: Record<string, string>;
  codes: PartnerCode[];
  tier_history: {
    tier_id: string;
    valid_from: string;
    valid_to: string | null;
    paying_customers: number;
    trigger_kind: string;
    note: string | null;
  }[];
}

export type ReferralStatus = "pending" | "approved" | "held" | "rejected";

export interface Referral {
  id: string;
  affiliate_id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_country: string | null;
  method: string;
  status: ReferralStatus;
  flags: string[];
  contact_opt_in: boolean;
  first_paid_at: string | null;
  commission_until: string | null;
  review_note: string | null;
  created_at: string;
}

export interface Provision {
  id: string;
  customer_label: string;
  kind: "earn" | "reversal" | "adjustment" | "override" | "bonus" | "lifetime" | "booking_share";
  amount: string;
  currency: string;
  base_amount: string;
  rate: string;
  tier_id: string;
  status: string;
  period: string | null;
  matures_at: string | null;
  created_at: string;
  /** null beim Aufstiegsbonus (hängt an keinem Betrieb). */
  tenant_id: string | null;
  stripe_invoice_id: string | null;
  reason: string | null;
  parent_id: string | null;
  source_affiliate_id: string | null;
  source_partner_name: string | null;
}

export interface Auszahlung {
  id: string;
  affiliate_id: string;
  currency: string;
  amount: string;
  method: string;
  status: "pending" | "processing" | "paid" | "failed";
  statement_no: string | null;
  external_ref: string | null;
  period_from: string | null;
  period_to: string | null;
  paid_at: string | null;
  failed_reason: string | null;
  created_at: string;
}

export interface Rang {
  id: string;
  name: string;
  min_customers: number;
  max_customers: number | null;
  rate: string;
}

export async function getPartnerListe(params?: {
  status?: PartnerStatus;
  suche?: string;
  limit?: number;
  offset?: number;
}): Promise<PartnerListe> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.suche) q.set("suche", params.suche);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const suffix = q.toString() ? `?${q}` : "";
  return api<PartnerListe>(`/platform/affiliates${suffix}`, { cache: "no-store" });
}

export async function getPartner(id: string): Promise<PartnerDetail> {
  return api<PartnerDetail>(`/platform/affiliates/${id}`, { cache: "no-store" });
}

export async function getPartnerReferrals(id: string): Promise<{ items: Referral[]; total: number }> {
  return api(`/platform/affiliates/${id}/referrals`, { cache: "no-store" });
}

export async function getPartnerProvisionen(id: string): Promise<{ items: Provision[]; total: number }> {
  return api(`/platform/affiliates/${id}/commissions?limit=200`, { cache: "no-store" });
}

export async function getAuszahlungen(status?: string): Promise<{ items: Auszahlung[]; total: number }> {
  const suffix = status ? `?status=${status}` : "";
  return api(`/platform/affiliates/payouts${suffix}`, { cache: "no-store" });
}

/** Die Staffel — öffentlich, ohne Bearer. */
export async function getRaenge(): Promise<Rang[]> {
  return api<Rang[]>("/affiliates/tiers", { cache: "no-store", isPublic: true });
}

export function prozent(rate: string): string {
  const n = Number(rate) * 100;
  return Number.isFinite(n) ? `${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %` : rate;
}

export const STATUS_LABEL: Record<PartnerStatus, string> = {
  pending_review: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  suspended: "Gesperrt",
};

export const REFERRAL_LABEL: Record<ReferralStatus, string> = {
  pending: "Registriert",
  approved: "Bestätigt",
  held: "Angehalten",
  rejected: "Abgelehnt",
};

export const FLAG_LABEL: Record<string, string> = {
  self_referral: "Selbstwerbung",
  same_email_domain: "Gleiche E-Mail-Domain",
  disposable_email: "Wegwerf-Adresse",
};

// --- Werbematerial (affiliate_assets) ---------------------------------------
// `file` kam mit 0707 dazu (Presse-PDF, Logo-Paket als ZIP). Die Union hängt an
// drei weiteren Stellen: dem Check in der DB, `MaterialArt` in schemas.py und
// `material.art.*` in allen 24 Sprachdateien des Partner-Dashboards.
export type MaterialArt = "video" | "image" | "text" | "link" | "file";
export type Material = {
  id: string;
  kind: MaterialArt;
  title: string;
  description: string | null;
  language: string | null;
  url: string | null;
  body: string | null;
  sort: number;
  active: boolean;
  created_at: string;
  // Nur bei einer EIGENEN Datei gesetzt; bei einer fremden Adresse alles null.
  download_url: string | null;
  filename: string | null;
  mime: string | null;
  bytes: number | null;
  /** Ordner im Backoffice (0709). null = kein Ordner. Rein organisatorisch —
   *  der Partner sieht weiterhin eine flache Liste. */
  folder_id: string | null;
};

/** Ein Reiter über der Materialliste. `anzahl` kommt vom Server: die
 *  Oberfläche zeigt nur den aktiven Ordner und könnte die anderen nicht zählen. */
export type Ordner = {
  id: string;
  name: string;
  sort: number;
  anzahl: number;
};

export async function getOrdner(): Promise<Ordner[]> {
  return api<Ordner[]>("/platform/affiliates/assets/folders", { cache: "no-store" });
}

export const MATERIAL_ART_LABEL: Record<MaterialArt, string> = {
  video: "Video",
  image: "Bild",
  text: "Textbaustein",
  link: "Link",
  file: "Datei",
};

/** Dateigröße menschenlesbar. Basis 1024 wie im Finder; ohne Wert kein
 *  geratener Ersatz, sondern gar keine Angabe (Wurzel 4). */
export function groesseLesbar(bytes: number | null): string | null {
  if (bytes === null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const einheiten = ["KB", "MB", "GB"];
  let wert = bytes / 1024;
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) {
    wert /= 1024;
    i += 1;
  }
  return `${wert < 10 ? wert.toFixed(1) : Math.round(wert)} ${einheiten[i]}`;
}

export async function getMaterial(): Promise<Material[]> {
  return api<Material[]>("/platform/affiliates/assets", { cache: "no-store" });
}

// --- Tracking: Aufrufe und Reichweite -----------------------------------------
export type TrackingTag = { day: string; clicks: number };
export type TrackingCode = {
  code: string;
  label: string | null;
  active: boolean;
  clicks_30d: number;
  clicks_90d: number;
  registrations: number;
};
export type TrackingQuelle = { name: string; clicks: number };
export type TrackingReichweite = {
  platform: Plattform;
  url: string;
  handle: string | null;
  followers: number | null;
};
export type Tracking = {
  clicks_7d: number;
  clicks_30d: number;
  clicks_90d: number;
  clicks_by_day: TrackingTag[];
  codes: TrackingCode[];
  referrers: TrackingQuelle[];
  utm_sources: TrackingQuelle[];
  registrations: number;
  registrations_30d: number;
  paying_customers: number;
  conversion_90d: number | null;
  reach_total: number;
  reach: TrackingReichweite[];
  team_size: number;
  team_revenue_30d: Betrag[];
  team_revenue_90d: Betrag[];
  override_30d: Betrag[];
  override_90d: Betrag[];
  sponsor_flags: string[];
  referral_flags: TrackingQuelle[];
};
export type TrackingSummary = {
  partners_total: number;
  partners_approved: number;
  partners_pending: number;
  clicks_30d: number;
  registrations_30d: number;
  registrations_total: number;
  paying_customers: number;
  reach_total: number;
};

export async function getTracking(id: string): Promise<Tracking> {
  return api<Tracking>(`/platform/affiliates/${id}/tracking`, { cache: "no-store" });
}

export async function getTrackingSummary(): Promise<TrackingSummary> {
  return api<TrackingSummary>("/platform/affiliates/tracking/summary", { cache: "no-store" });
}

export type Betrag = { amount: string; currency: string };

// --- Team (0520) --------------------------------------------------------------
export type TeamMitglied = {
  affiliate_id: string;
  name: string;
  company: string | null;
  email: string;
  status: PartnerStatus;
  current_tier_id: string;
  joined_at: string | null;
  flags: string[];
  paying_customers: number;
  revenue_total: Betrag[];
  override_total: Betrag[];
};
export type Team = {
  sponsor: TeamMitglied | null;
  members: TeamMitglied[];
  override_pending: Betrag[];
  override_approved: Betrag[];
  override_paid: Betrag[];
};

export async function getTeam(id: string): Promise<Team> {
  return api<Team>(`/platform/affiliates/${id}/team`, { cache: "no-store" });
}

export const TEAM_FLAG_LABEL: Record<string, string> = {
  same_email_domain: "gleiche E-Mail-Domain wie Sponsor",
  same_iban: "gleiche IBAN wie Sponsor/Team-Partner",
};

// --- Videofreigabe (0523) -----------------------------------------------------
// Ein Influencer bekommt den Link zu seinem Beitrag ERST, wenn wir sein Video
// gesehen und freigegeben haben. Diese Liste ist der Prüfeingang.
export type AblehnungsGrund = "material" | "promise" | "disclosure" | "brand" | "other";
// Prüfliste der Beitragsfreigabe — die Content-Regeln des Programms.
export const ABLEHNUNGSGRUND_LABEL: Record<AblehnungsGrund, string> = {
  material: "Nicht nur offizielles Material / eigene Bildschirmaufnahmen",
  promise: "Garantie- oder Erfolgsversprechen",
  disclosure: "Kennzeichnung als Werbung fehlt",
  brand: "Markenverstoß (Logo, Name, Brand-Bidding)",
  other: "Sonstiges (siehe Begründung)",
};
export type VideoStand = "draft" | "submitted" | "approved" | "rejected";

export type VideoBeitrag = {
  id: string;
  affiliate_id: string;
  partner_name: string | null;
  partner_email: string | null;
  platform: string;
  title: string;
  url: string | null;
  review_status: VideoStand;
  /** Prüflisten-Kategorie der letzten Ablehnung (0526). */
  review_reason_code: AblehnungsGrund | null;
  review_note: string | null;
  review_runde: number;
  /** Kurzlebige signierte Adresse — null, wenn die Datei fehlt. */
  video_url: string | null;
  video_size: number | null;
  video_mime: string | null;
  video_uploaded_at: string | null;
  created_at: string;
};

export async function getOffeneVideos(): Promise<VideoBeitrag[]> {
  return api<VideoBeitrag[]>("/platform/affiliates/videos/pending", { cache: "no-store" });
}

// --- Leads (0526) -------------------------------------------------------------
export type LeadKategorie = "A" | "B" | "C" | "D";
export type LeadStatus = "open" | "contacted" | "in_talks" | "won" | "declined" | "parked";
export const LEAD_KATEGORIE_LABEL: Record<LeadKategorie, string> = {
  A: "A · Coaches & Akademien",
  B: "B · FeWo-Berater & Podcaster",
  C: "C · Micro-Influencer & Side-Hustle",
  D: "D · Co-Hosting-Agenturen & Property Manager",
};
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  open: "Offen",
  contacted: "Kontaktiert",
  in_talks: "Im Gespräch",
  won: "Gewonnen",
  declined: "Abgelehnt",
  parked: "Geparkt",
};
export interface LeadKanal {
  platform: string;
  url: string;
  handle: string | null;
  followers: number | null;
}
export interface Lead {
  id: string;
  name: string;
  organisation: string | null;
  category: LeadKategorie;
  channels: LeadKanal[];
  reach: number | null;
  country: string | null;
  language: string | null;
  status: LeadStatus;
  owner_user_id: string | null;
  next_step: string | null;
  next_step_at: string | null;
  notes: string | null;
  affiliate_id: string | null;
  created_at: string;
  updated_at: string;
}
export async function getLeads(params?: {
  status?: LeadStatus;
  category?: LeadKategorie;
  q?: string;
}): Promise<{ total: number; items: Lead[] }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.category) sp.set("category", params.category);
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  return api<{ total: number; items: Lead[] }>(
    `/platform/affiliates/leads${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
}
