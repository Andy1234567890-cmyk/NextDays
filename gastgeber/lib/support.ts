// Support-Tickets des Betriebs (Lesen). Der Ticket-Eingang liegt im
// support-Slice der FastAPI; interne Team-Notizen filtert der Server heraus und
// tauchen hier gar nicht erst auf.
import { api } from "./api-server";

export type TicketStatus = "open" | "waiting" | "resolved" | "closed";

export interface TicketMessage {
  id: string;
  author_kind: "reporter" | "agent";
  body: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  subject: string;
  category: string | null;
  status: TicketStatus;
  priority: string;
  created_at: string;
  last_message_at: string | null;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export interface TicketList {
  items: Ticket[];
  total: number;
}

/** Die eigenen Tickets, zuletzt aktive zuerst. */
export async function getTickets(): Promise<TicketList> {
  return api<TicketList>("/support?limit=100", { cache: "no-store" });
}

/** Ein eigenes Ticket mit Verlauf. */
export async function getTicket(id: string): Promise<TicketDetail> {
  return api<TicketDetail>(`/support/${id}`, { cache: "no-store" });
}
