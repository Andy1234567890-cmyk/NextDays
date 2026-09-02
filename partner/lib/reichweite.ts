// Reichweite (0521): Beiträge mit eigenem Link, verbundene Plattform-Konten,
// eigene Kennzahlen. Lesezugriffe — jeder Endpunkt ist serverseitig auf die
// eigene affiliate_id gescopet; diese Datei ist Transport.
import { api } from "./api-server";

export type Provider = "youtube" | "meta" | "tiktok";

export interface BeitragMetrik {
  measured_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

/** Freigabestand des Beitragsvideos (0523): ohne `approved` gibt es keinen Link. */
export type AblehnungsGrund = "material" | "promise" | "disclosure" | "brand" | "other";
export type VideoStand = "draft" | "submitted" | "approved" | "rejected";

export interface Beitrag {
  id: string;
  code_id: string;
  code: string;
  platform: string;
  url: string | null;
  title: string;
  utm_content: string;
  /** Fertiger Link — null, solange das Video nicht freigegeben ist (0523). */
  link: string | null;
  review_status: VideoStand;
  /** Prüflisten-Kategorie der letzten Ablehnung (0526). */
  review_reason_code: AblehnungsGrund | null;
  review_note: string | null;
  video_vorhanden: boolean;
  video_uploaded_at: string | null;
  published_at: string | null;
  created_at: string;
  clicks_30d: number;
  clicks_90d: number;
  registrations: number;
  paying_customers: number;
  metrics: BeitragMetrik | null;
  clicks_per_1000_views: number | null;
}

export interface KanalVerbindung {
  id: string;
  provider: Provider;
  platform: string;
  external_account_id: string;
  account_name: string | null;
  account_url: string | null;
  connected_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  followers: number | null;
  views_28d: number | null;
  engagement_rate: number | null;
  posts_count: number | null;
  measured_at: string | null;
}

export interface KanalAnbieterStatus {
  provider: Provider;
  platforms: string[];
  /** false = Zugangsdaten fehlen in der Umgebung; der Knopf bleibt aus. */
  configured: boolean;
}

export interface KanalUebersicht {
  providers: KanalAnbieterStatus[];
  connections: KanalVerbindung[];
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

export interface Reichweite {
  channels: KanalReichweite[];
  posts: Beitrag[];
}

export const getBeitraege = () => api<Beitrag[]>("/affiliates/posts");
export const getKanaele = () => api<KanalUebersicht>("/affiliates/channels");
export const getReichweite = () => api<Reichweite>("/affiliates/reach");
