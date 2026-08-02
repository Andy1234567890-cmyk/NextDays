"use server";

// Bewertungen: Server-Actions gegen den FastAPI-Slice (/api/v1/reviews).
// EINE Liste über alle Kanäle — myBestDays-Marktplatz und die Portale
// (Booking.com/Airbnb/Expedia) kommen normalisiert aus dem Backend, die
// Rohnote samt ihrer Skala bleibt erhalten.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Herkunft einer Bewertung. Bestimmt den Schreibpfad: der Marktplatz wird
 *  direkt beschrieben, eine Portal-Antwort geht zuerst zum Portal. */
export type ReviewSource = "marketplace" | "ota";

/** Skala der Rohnote: die Portale rechnen auf 10, myBestDays auf 5. */
export type ReviewScale = "1-5" | "0-10";

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
  /** Auf 5 Sterne normalisiert. null heißt: keine Note — dann keine Sterne zeigen. */
  score_5: number | null;
  categories: CategoryScore[];
  reply: string | null;
  reply_at: string | null;
  is_replied: boolean;
  /** false, wenn das Antwortfenster des Portals zu ist. */
  can_reply: boolean;
  /** myBestDays: null = noch verdeckt (Zwei-Wege-Frist läuft). */
  published_at: string | null;
  /** Portale: Airbnb hält verdeckt, bis beide Seiten abgegeben haben. */
  is_hidden: boolean;
  reservation_id: string | null;
  ota_reservation_id: string | null;
  guest_rated: boolean;
  received_at: string | null;
};

export type ReviewList = {
  items: UnifiedReview[];
  total: number;
  limit: number;
  offset: number;
};

export type ChannelSummary = {
  channel_code: string;
  count: number;
  average_5: number | null;
  unanswered: number;
};

export type ReviewSummary = {
  count: number;
  average_5: number | null;
  unanswered: number;
  /** Anteil beantworteter Bewertungen (0..1). null bei null Bewertungen. */
  response_rate: number | null;
  by_channel: ChannelSummary[];
};

export type AutomationConfig = {
  auto_review_active: boolean;
  auto_review_after_days: number;
  auto_review_min_rating: number | null;
  auto_review_rating: number;
  auto_review_public: string | null;
  auto_review_private: string | null;
  guest_reminder_active: boolean;
  guest_reminder_after_days: number;
};

/** Zustand eines geplanten Eintrags in der Warteschlange. */
export type QueueStatus =
  | "geplant"
  | "gesendet"
  | "uebersprungen"
  | "abgelaufen"
  | "fehler";

export type QueueEntry = {
  id: string;
  source: ReviewSource;
  status: QueueStatus;
  property_id: string | null;
  property_title: string | null;
  guest_name: string | null;
  reservation_id: string | null;
  review_id: string | null;
  send_at: string;
  expires_at: string | null;
  /** Tage bis zum Versand. Negativ = überfällig. */
  days_until_send: number | null;
  /** Tage bis das Fenster zugeht. null = Frist des Kanals unbekannt. */
  days_left: number | null;
  rating: number;
  text: string | null;
  private_text: string | null;
  scores: {
    cleanliness: number | null;
    communication: number | null;
    house_rules: number | null;
  };
  recommended: boolean;
  tags: string[];
  sent_at: string | null;
  error: string | null;
};

export type QueueList = {
  items: QueueEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type QueuePatch = {
  rating?: number;
  text?: string | null;
  private_text?: string | null;
  recommended?: boolean;
  score_cleanliness?: number | null;
  score_communication?: number | null;
  score_house_rules?: number | null;
};

export type QualityPoint = {
  date: string;
  count: number;
  /** null an Tagen ohne Bewertung — kein Nullpunkt im Verlauf. */
  average_5: number | null;
};

export type QualityProperty = {
  property_id: string;
  title: string | null;
  count: number;
  average_5: number | null;
  unanswered: number;
};

export type QualityDashboard = {
  from_date: string;
  to_date: string;
  count: number;
  average_5: number | null;
  five_star_rate: number | null;
  response_rate: number | null;
  categories: CategoryScore[];
  series: QualityPoint[];
  by_property: QualityProperty[];
};

export type ReviewFilter = {
  source?: ReviewSource;
  propertyId?: string;
  channelCode?: string;
  unanswered?: boolean;
  limit?: number;
  offset?: number;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export async function listReviews(filter: ReviewFilter = {}): Promise<Result<ReviewList>> {
  const qs = new URLSearchParams();
  if (filter.source) qs.set("source", filter.source);
  if (filter.propertyId) qs.set("property_id", filter.propertyId);
  if (filter.channelCode) qs.set("channel_code", filter.channelCode);
  if (filter.unanswered) qs.set("unanswered", "true");
  if (filter.limit != null) qs.set("limit", String(filter.limit));
  if (filter.offset != null) qs.set("offset", String(filter.offset));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/reviews${suffix}`);
}

export async function reviewSummary(): Promise<Result<ReviewSummary>> {
  return call("/reviews/summary");
}

export async function replyToReview(
  source: ReviewSource,
  id: string,
  reply: string,
): Promise<Result<UnifiedReview>> {
  return call(`/reviews/${source}/${id}/reply`, { method: "PUT", body: { reply } });
}

export async function deleteReviewReply(id: string): Promise<Result<void>> {
  return call(`/reviews/marketplace/${id}/reply`, { method: "DELETE" });
}

export async function syncOtaReviews(): Promise<Result<{ mirrored: number }>> {
  return call("/reviews/sync", { method: "POST" });
}

export async function getReviewAutomation(): Promise<Result<AutomationConfig>> {
  return call("/reviews/automation");
}

export async function saveReviewAutomation(
  cfg: AutomationConfig,
): Promise<Result<AutomationConfig>> {
  return call("/reviews/automation", { method: "PUT", body: cfg });
}

export async function rateGuest(input: {
  reservation_id: string;
  rating: number;
  text?: string | null;
  scores?: {
    cleanliness?: number | null;
    communication?: number | null;
    house_rules?: number | null;
  };
}): Promise<Result<{ id: string }>> {
  return call("/reviews/guest-rating", { method: "POST", body: input });
}

export async function sendOtaGuestReview(
  id: string,
  input: {
    rating: number;
    public_review?: string | null;
    private_review?: string | null;
    recommended?: boolean;
    scores?: {
      cleanliness?: number | null;
      communication?: number | null;
      house_rules?: number | null;
    };
  },
): Promise<Result<UnifiedReview>> {
  return call(`/reviews/ota/${id}/guest-review`, { method: "POST", body: input });
}

// --- Warteschlange -----------------------------------------------------------

export async function listQueue(
  opts: { status?: QueueStatus; limit?: number; offset?: number } = {},
): Promise<Result<QueueList>> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  qs.set("limit", String(opts.limit ?? 25));
  qs.set("offset", String(opts.offset ?? 0));
  return call(`/reviews/queue?${qs.toString()}`);
}

export async function updateQueueEntry(
  id: string,
  patch: QueuePatch,
): Promise<Result<QueueEntry>> {
  return call(`/reviews/queue/${id}`, { method: "PATCH", body: patch });
}

export async function skipQueueEntry(id: string): Promise<Result<QueueEntry>> {
  return call(`/reviews/queue/${id}/skip`, { method: "POST" });
}

/** Jetzt abschicken statt auf die Fälligkeit zu warten. Unumkehrbar. */
export async function sendQueueEntry(id: string): Promise<Result<QueueEntry>> {
  return call(`/reviews/queue/${id}/send`, { method: "POST" });
}

// --- Qualität ----------------------------------------------------------------

export async function reviewQuality(
  range: { from?: string; to?: string } = {},
): Promise<Result<QualityDashboard>> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/reviews/quality${suffix}`);
}
