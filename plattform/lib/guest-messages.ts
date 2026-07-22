// Nachrichten-Threads zwischen Gast und Gastgeber (/api/v1/guest-messages).
// Realtime-Updates laufen über Supabase (guest_messages/guest_message_threads),
// nicht über Polling — siehe components/nachrichten-client.tsx.
import { guestCall, type Result } from "./guest-api";

export type MessageThread = {
  id: string;
  reservation_id: string | null;
  property_id: string | null;
  property_title: string | null;
  check_in: string | null;
  check_out: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender: "guest" | "host";
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ThreadDetail = {
  id: string;
  reservation_id: string | null;
  property_id: string | null;
  last_message_at: string | null;
  messages: ChatMessage[];
};

export async function ladeThreads(): Promise<
  Result<{ threads: MessageThread[] }>
> {
  return guestCall("guest-messages/threads");
}

export async function ladeThread(
  threadId: string,
): Promise<Result<ThreadDetail>> {
  return guestCall(`guest-messages/threads/${encodeURIComponent(threadId)}`);
}

export async function starteThread(
  reservationId: string,
): Promise<Result<MessageThread>> {
  return guestCall("guest-messages/threads", {
    method: "POST",
    body: { reservation_id: reservationId },
  });
}

export async function sendeNachricht(
  threadId: string,
  body: string,
): Promise<Result<ChatMessage>> {
  return guestCall(
    `guest-messages/threads/${encodeURIComponent(threadId)}/messages`,
    { method: "POST", body: { body } },
  );
}
