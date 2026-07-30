"use server";

// Live-Chat mit dem myNextDays-Team: Server-Actions gegen den FastAPI-
// support-Slice (/api/v1/support). Der Chat ist eine Konversation im
// Support-Modell — dieselben Daten sehen die Kolleg:innen im Backoffice.
//
// Alles läuft über Server-Actions, weil das Zugangs-Token in einem httpOnly-
// Cookie liegt und den Browser nie verlässt. Live wird die Ansicht nicht über
// Nachladen, sondern über Supabase-Realtime (WebSocket) — siehe
// components/support/support-chat.tsx.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Status aus Melder-Sicht (der interne Status wird serverseitig übersetzt). */
export type ChatStatus = "in_bearbeitung" | "wartet_auf_dich" | "geloest";

export type ChatMessage = {
  id: string;
  author_kind: "reporter" | "agent";
  body: string;
  created_at: string;
  client_msg_id: string | null;
};

export type ChatConversation = {
  id: string;
  subject: string;
  category: string | null;
  status: ChatStatus;
  priority: string;
  created_at: string;
  last_message_at: string | null;
  source: "form" | "chat";
  last_message_preview: string | null;
  last_message_kind: "reporter" | "agent" | null;
  unread: number;
  agent_last_read_at: string | null;
  rating: number | null;
};

export type ChatConversationDetail = ChatConversation & {
  messages: ChatMessage[];
};

export type ChatUnread = { conversations: number; messages: number };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/support${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

/** Eigene Konversationen, zuletzt aktive zuerst. */
export async function listConversations(): Promise<
  Result<{ items: ChatConversation[]; total: number }>
> {
  return call<{ items: ChatConversation[]; total: number }>("?limit=50");
}

/** Eine eigene Konversation mit Verlauf (ohne interne Team-Notizen). */
export async function getConversation(
  id: string,
): Promise<Result<ChatConversationDetail>> {
  return call<ChatConversationDetail>(`/${id}`);
}

/**
 * Eine Konversation eröffnen. `clientMsgId` macht den Aufruf idempotent:
 * Doppelklick oder ein Retry nach Timeout eröffnen keine zweite Unterhaltung.
 */
export async function startConversation(
  body: string,
  clientMsgId: string,
): Promise<Result<ChatConversationDetail>> {
  return call<ChatConversationDetail>("/chat", {
    method: "POST",
    body: { body, client_msg_id: clientMsgId },
  });
}

/** Antworten. Ebenfalls idempotent über die client_msg_id. */
export async function sendMessage(
  conversationId: string,
  body: string,
  clientMsgId: string,
): Promise<Result<ChatMessage>> {
  return call<ChatMessage>(`/${conversationId}/reply`, {
    method: "POST",
    body: { body, client_msg_id: clientMsgId },
  });
}

/** Lese-Cursor setzen (Verlauf geöffnet) — Grundlage der Ungelesen-Zählung. */
export async function markRead(
  conversationId: string,
): Promise<Result<{ ok: boolean }>> {
  return call<{ ok: boolean }>(`/${conversationId}/read`, { method: "POST" });
}

/** Ungelesene Team-Antworten über alle Konversationen (Badge). */
export async function unreadSummary(): Promise<Result<ChatUnread>> {
  return call<ChatUnread>("/unread");
}

/** Abgeschlossene Konversation bewerten (1–5). */
export async function rateConversation(
  conversationId: string,
  rating: number,
  comment?: string,
): Promise<Result<{ ok: boolean }>> {
  return call<{ ok: boolean }>(`/${conversationId}/rating`, {
    method: "POST",
    body: { rating, comment: comment || null },
  });
}
