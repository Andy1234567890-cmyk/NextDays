// Bewertungen — gegen den FastAPI-reviews-Slice (/api/v1/reviews), gespiegelt
// aus web/lib/reviews.ts. Eine Liste über ALLE Kanäle: myBestDays-Marktplatz
// (Skala 1..5) und die Portale über Channex (Skala 0..10). Die Rohnote kommt
// mitsamt ihrer Skala; `score_5` ist die für die Sterne normalisierte Fassung.
import { call, type Result } from "@/lib/api";

export type ReviewSource = "marketplace" | "ota";
export type ReviewScale = "1-5" | "0-10";

/** Kanal-Code der eigenen Marktplatz-Bewertungen. */
export const MARKETPLACE_CHANNEL = "myBestDays";

export type CategoryScore = {
  key: string;
  score: number;
  scale: ReviewScale;
};

export type UnifiedReview = {
  source: ReviewSource;
  id: string;
  channel_code: string;
  property_id: string | null;
  property_title: string | null;
  author: string;
  text: string | null;
  score: number | null;
  scale: ReviewScale;
  /** null = keine Note → keine Sterne rendern (nie 0 erfinden). */
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
};

export type ReviewSummary = {
  count: number;
  average_5: number | null;
  unanswered: number;
  response_rate: number | null;
  by_channel: {
    channel_code: string;
    count: number;
    average_5: number | null;
    unanswered: number;
  }[];
};

/** Bewertungen aller Kanäle (neueste zuerst). */
export async function listReviews(
  opts: { unanswered?: boolean; limit?: number; offset?: number } = {},
): Promise<Result<{ items: UnifiedReview[]; total: number }>> {
  const params = new URLSearchParams();
  if (opts.unanswered) params.set("unanswered", "true");
  params.set("limit", String(opts.limit ?? 25));
  params.set("offset", String(opts.offset ?? 0));
  return call(`/reviews?${params.toString()}`);
}

export async function reviewSummary(): Promise<Result<ReviewSummary>> {
  return call("/reviews/summary");
}

/** Öffentlich antworten. Beim Portal geht die Antwort zuerst dorthin — erst
 *  nach Erfolg steht sie im eigenen Bestand (das erledigt das Backend). */
export async function replyToReview(
  source: ReviewSource,
  id: string,
  reply: string,
): Promise<Result<UnifiedReview>> {
  return call(`/reviews/${source}/${encodeURIComponent(id)}/reply`, {
    method: "PUT",
    body: { reply },
  });
}
