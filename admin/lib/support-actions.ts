"use server";

// Schreib-Actions des Support-Bereichs. Anders als Freigaben darf hier auch
// platform_support handeln — das ist genau die Aufgabe dieser Rolle.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { SupportMessage, SupportTicket, TicketStatus } from "./backoffice";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/** Antworten oder eine interne Notiz anhängen. */
export async function antworten(
  ticketId: string,
  text: string,
  intern: boolean,
): Promise<Ergebnis<SupportMessage>> {
  try {
    const data = await api<SupportMessage>(
      `/platform/support/${ticketId}/reply`,
      { method: "POST", body: { body: text, internal: intern } },
    );
    revalidatePath(`/support/${ticketId}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Antwort fehlgeschlagen.",
    };
  }
}

/** Status eines Tickets ändern. */
export async function statusSetzen(
  ticketId: string,
  status: TicketStatus,
): Promise<Ergebnis<SupportTicket>> {
  try {
    const data = await api<SupportTicket>(`/platform/support/${ticketId}`, {
      method: "PATCH",
      body: { status },
    });
    revalidatePath(`/support/${ticketId}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Änderung fehlgeschlagen.",
    };
  }
}
