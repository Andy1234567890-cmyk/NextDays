"use server";

// Actions des Support-Bereichs. Anders als Freigaben darf hier auch
// platform_support handeln — das ist genau die Aufgabe dieser Rolle.
//
// Auch die LESE-Zugriffe laufen als Server-Action: die Konsole ist eine
// Client-Komponente (Live-Chat), das Bearer-Token liegt aber in einem
// httpOnly-Cookie und darf den Server nie verlassen.
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type {
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketList,
  TicketStatus,
} from "./backoffice";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

async function call<T>(
  pfad: string,
  opts: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
  fehlertext = "Aktion fehlgeschlagen.",
): Promise<Ergebnis<T>> {
  try {
    const data = await api<T>(pfad, { ...opts, cache: "no-store" });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler: exc instanceof ApiError ? exc.message : fehlertext,
    };
  }
}

/** Konversationen für die Konsole (Filter wie in der Liste). */
export async function konversationen(filter: {
  status?: TicketStatus;
  source?: "form" | "chat" | "web" | "partner";
  mine?: boolean;
}): Promise<Ergebnis<SupportTicketList>> {
  const q = new URLSearchParams({ limit: "100" });
  if (filter.status) q.set("status_filter", filter.status);
  if (filter.source) q.set("source", filter.source);
  if (filter.mine) q.set("mine", "true");
  return call<SupportTicketList>(
    `/platform/support?${q}`,
    {},
    "Liste konnte nicht geladen werden.",
  );
}

/** Eine Konversation mit vollem Verlauf (inkl. interner Notizen). */
export async function konversation(
  ticketId: string,
): Promise<Ergebnis<SupportTicketDetail>> {
  return call<SupportTicketDetail>(
    `/platform/support/${ticketId}`,
    {},
    "Konversation konnte nicht geladen werden.",
  );
}

/** Antworten oder eine interne Notiz anhängen. */
export async function antworten(
  ticketId: string,
  text: string,
  intern: boolean,
  clientMsgId?: string,
): Promise<Ergebnis<SupportMessage>> {
  return call<SupportMessage>(
    `/platform/support/${ticketId}/reply`,
    {
      method: "POST",
      body: { body: text, internal: intern, client_msg_id: clientMsgId ?? null },
    },
    "Antwort fehlgeschlagen.",
  );
}

/** Status eines Tickets ändern. */
export async function statusSetzen(
  ticketId: string,
  status: TicketStatus,
): Promise<Ergebnis<SupportTicket>> {
  return call<SupportTicket>(
    `/platform/support/${ticketId}`,
    { method: "PATCH", body: { status } },
    "Änderung fehlgeschlagen.",
  );
}

/** Konversation jemandem zuweisen (oder die Zuweisung an sich ziehen). */
export async function zuweisen(
  ticketId: string,
  assigneeUserId: string,
): Promise<Ergebnis<SupportTicket>> {
  return call<SupportTicket>(
    `/platform/support/${ticketId}`,
    { method: "PATCH", body: { assignee_user_id: assigneeUserId } },
    "Zuweisung fehlgeschlagen.",
  );
}

/** Lese-Cursor des Teams setzen (Konversation geöffnet). */
export async function gelesenMarkieren(
  ticketId: string,
): Promise<Ergebnis<{ ok: boolean }>> {
  return call<{ ok: boolean }>(
    `/platform/support/${ticketId}/read`,
    { method: "POST" },
    "Lesestand konnte nicht gesetzt werden.",
  );
}
