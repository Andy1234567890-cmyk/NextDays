// Konversationen mit dem Partnerteam (Support-Modell, Welt „Partner", 0518).
// Interne Team-Notizen filtert der Server; sie erreichen den Client nie.
import { api } from "./api-server";

export type ChatStatus = "in_bearbeitung" | "wartet_auf_dich" | "geloest";

export interface Nachricht {
  id: string;
  author_kind: "reporter" | "agent";
  body: string;
  created_at: string;
  client_msg_id: string | null;
}

export interface Konversation {
  id: string;
  subject: string;
  status: ChatStatus;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_kind: "reporter" | "agent" | null;
  unread: number;
}

export interface KonversationDetail extends Konversation {
  messages: Nachricht[];
}

export const getKonversationen = () =>
  api<{ items: Konversation[]; total: number }>("/support/partner/list?limit=100");
export const getKonversation = (id: string) =>
  api<KonversationDetail>(`/support/partner/${encodeURIComponent(id)}`);
export const getUngelesen = () => api<{ conversations: number; messages: number }>("/support/partner/unread");
