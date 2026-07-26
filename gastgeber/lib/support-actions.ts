"use server";

// Schreib-Actions für Support-Tickets des Gastgebers.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { TicketDetail, TicketMessage } from "./support";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/** Ein neues Ticket eröffnen. */
export async function ticketAnlegen(
  betreff: string,
  text: string,
  kategorie?: string,
): Promise<Ergebnis<TicketDetail>> {
  try {
    const data = await api<TicketDetail>("/support", {
      method: "POST",
      body: {
        subject: betreff,
        body: text,
        category: kategorie || null,
      },
    });
    revalidatePath("/support");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Anfrage konnte nicht gesendet werden.",
    };
  }
}

/** Auf das eigene Ticket antworten. */
export async function ticketAntworten(
  ticketId: string,
  text: string,
): Promise<Ergebnis<TicketMessage>> {
  try {
    const data = await api<TicketMessage>(`/support/${ticketId}/reply`, {
      method: "POST",
      body: { body: text },
    });
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
