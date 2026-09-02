// Reichweite (0521): Beiträge, verifizierte Kanäle, Verdachtsflags, Schwellen.
// Lesezugriffe des Backoffice; jeder Aufruf steht im Audit-Log der API.
import { api } from "./api-server";

export interface BeitragMetrik {
  measured_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export interface Beitrag {
  id: string;
  affiliate_id: string;
  partner_name: string;
  code_id: string;
  code: string;
  platform: string;
  url: string | null;
  title: string;
  utm_content: string;
  link: string | null;
  published_at: string | null;
  created_at: string;
  clicks_30d: number;
  clicks_90d: number;
  registrations: number;
  paying_customers: number;
  metrics: BeitragMetrik | null;
  clicks_per_1000_views: number | null;
}

export interface FollowerTag {
  day: string;
  followers: number | null;
}

export interface KanalReichweite {
  platform: string;
  account_name: string | null;
  account_url: string | null;
  verified: boolean;
  followers_verified: number | null;
  followers_self_reported: number | null;
  deviation_pct: number | null;
  views_28d: number | null;
  engagement_rate: number | null;
  posts_count: number | null;
  measured_at: string | null;
  follower_history: FollowerTag[];
  clicks_28d: number;
  clicks_90d: number;
  clicks_per_1000_views: number | null;
  revoked_at: string | null;
  last_error: string | null;
}

export interface ReichweiteFlag {
  key: string;
  subject: string;
  value: number;
  threshold: number;
  detail: string;
}

export interface Reichweite {
  channels: KanalReichweite[];
  reach_verified: number;
  reach_self_reported: number;
  flags: ReichweiteFlag[];
  posts: Beitrag[];
}

export interface TopKanal {
  affiliate_id: string;
  partner_name: string;
  platform: string;
  followers: number;
  paying_customers: number;
  customers_per_1000_followers: number;
}

export interface ReichweiteSummary {
  reach_verified: number;
  reach_self_reported: number;
  connections_active: number;
  connections_revoked: number;
  partners_with_connection: number;
  flags_total: number;
  top_channels: TopKanal[];
  top_posts: Beitrag[];
}

export interface Schwelle {
  key: string;
  value: number | null;
  description: string;
  updated_at: string;
}

// Flag-Schlüssel → Klartext (reichweite.flags_bestimmen).
export const FLAG_TEXT: Record<string, string> = {
  follower_jump: "Follower-Sprung ohne passende Views",
  low_engagement: "Engagement zu niedrig für die Followerzahl",
  self_report_deviation: "Selbstauskunft weicht vom verifizierten Wert ab",
  views_without_click: "Viele Views, kein einziger Klick",
};

export const SCHWELLE_LABEL: Record<string, string> = {
  follower_jump_pct_7d: "Follower-Sprung in 7 Tagen (%)",
  follower_jump_min_followers: "… ab Followerzahl",
  low_engagement_rate_pct: "Engagement-Rate unter (%)",
  low_engagement_min_followers: "… ab Followerzahl",
  self_report_deviation_pct: "Abweichung Selbstauskunft (%)",
  views_without_click_min: "Views ohne Klick ab",
};

export const getReichweite = (id: string) =>
  api<Reichweite>(`/platform/affiliates/${id}/reach`, { cache: "no-store" });
export const getReichweiteSummary = () =>
  api<ReichweiteSummary>("/platform/affiliates/reach/summary", { cache: "no-store" });
export const getTopBeitraege = (limit = 20) =>
  api<Beitrag[]>(`/platform/affiliates/posts/top?limit=${limit}`, { cache: "no-store" });
export const getSchwellen = () =>
  api<Schwelle[]>("/platform/affiliates/reach/thresholds", { cache: "no-store" });
