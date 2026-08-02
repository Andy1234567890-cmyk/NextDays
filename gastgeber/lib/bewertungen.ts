// Data-Layer Bewertungen (Gastgeber-Seite) über den DAL. Backend: reviews-Slice
// (/api/v1/reviews) — dasselbe Cockpit wie im PMS, hier auf die Objekte des
// Gastgebers gescopt. Die Portal-Bewertungen sind bewusst mit dabei: der
// Gastgeber sieht seinen Ruf über alle Kanäle, veröffentlicht wird davon nichts.
import { api } from "./api-server";

export type ReviewSource = "marketplace" | "ota";
export type ReviewScale = "1-5" | "0-10";

export const MARKETPLACE_CHANNEL = "myBestDays";

export interface CategoryScore {
  key: string;
  score: number;
  scale: ReviewScale;
}

export interface UnifiedReview {
  source: ReviewSource;
  id: string;
  channel_code: string;
  property_id: string | null;
  property_title: string | null;
  author: string;
  text: string | null;
  score: number | null;
  scale: ReviewScale;
  /** Auf 5 Sterne normalisiert. null = keine Note → keine Sterne zeigen. */
  score_5: number | null;
  categories: CategoryScore[];
  reply: string | null;
  reply_at: string | null;
  is_replied: boolean;
  can_reply: boolean;
  published_at: string | null;
  is_hidden: boolean;
  reservation_id: string | null;
  ota_reservation_id: string | null;
  guest_rated: boolean;
  received_at: string | null;
}

export interface ReviewList {
  items: UnifiedReview[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChannelSummary {
  channel_code: string;
  count: number;
  average_5: number | null;
  unanswered: number;
}

export interface ReviewSummary {
  count: number;
  average_5: number | null;
  unanswered: number;
  response_rate: number | null;
  by_channel: ChannelSummary[];
}

/** Bewertungen des Gastgebers. Leere Liste, wenn der Slice nicht antwortet —
 *  die Seite zeigt dann „noch keine Bewertungen" statt zu crashen. */
export async function getBewertungen(
  opts: { unanswered?: boolean; limit?: number; offset?: number } = {},
): Promise<ReviewList> {
  const qs = new URLSearchParams();
  if (opts.unanswered) qs.set("unanswered", "true");
  qs.set("limit", String(opts.limit ?? 25));
  qs.set("offset", String(opts.offset ?? 0));
  return api<ReviewList>(`/reviews?${qs.toString()}`);
}

export async function getBewertungsKennzahlen(): Promise<ReviewSummary> {
  return api<ReviewSummary>("/reviews/summary");
}
