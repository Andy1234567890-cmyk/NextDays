"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { KonversationDetail, Nachricht } from "./support";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string; status?: number };

export async function konversationStarten(text: string, clientMsgId: string): Promise<Ergebnis<KonversationDetail>> {
  try {
    const data = await api<KonversationDetail>("/support/partner/chat", {
      method: "POST",
      body: { body: text, client_msg_id: clientMsgId },
    });
    revalidatePath("/nachrichten");
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) return { ok: false, fehler: exc.message, status: exc.status };
    return { ok: false, fehler: "service_unavailable", status: 503 };
  }
}

export async function antworten(ticketId: string, text: string, clientMsgId: string): Promise<Ergebnis<Nachricht>> {
  try {
    const data = await api<Nachricht>(`/support/partner/${encodeURIComponent(ticketId)}/reply`, {
      method: "POST",
      body: { body: text, client_msg_id: clientMsgId },
    });
    revalidatePath(`/nachrichten/${ticketId}`);
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) return { ok: false, fehler: exc.message, status: exc.status };
    return { ok: false, fehler: "service_unavailable", status: 503 };
  }
}

export async function gelesen(ticketId: string): Promise<void> {
  try {
    await api(`/support/partner/${encodeURIComponent(ticketId)}/read`, { method: "POST", body: {} });
  } catch {
    // Lese-Cursor ist Komfort — ein Fehler hier darf die Ansicht nicht kippen.
  }
}
