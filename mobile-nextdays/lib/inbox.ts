// Posteingang — gegen den FastAPI-inbox-Slice (/api/v1/inbox), gespiegelt aus
// apps/web/lib/inbox.ts. Nur die Pfade, die die App aktuell braucht:
// Thread-Liste, Nachrichten eines Threads, Antwort senden.
import { call, type Result } from "@/lib/api";

export type InboxThread = {
  id: string;
  channex_booking_id: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  property_id: string | null;
  property_title: string | null;
  ota_name: string | null;
  ota_reservation_code: string | null;
  guest_name: string | null;
  guest_email: string | null; // maskiert (null ohne Kontakt-Sicht)
  status: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  last_message: string | null;
  updated_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  inbox_status: "active" | "archived" | "trashed";
  assigned_user_id: string | null;
  assigned_user_name: string | null;
};

export type InboxMessage = {
  id: string | null;
  message: string;
  sender: "guest" | "property" | "note";
  sent_at: string | null;
  author_name?: string | null;
  /**
   * Bildanhänge. Schickt der Gast NUR ein Foto, ist `message` leer — dann
   * trägt allein diese Liste den Inhalt. Der Server hat jede URL auf https +
   * bekannten Host geprüft (`inbox.spiegel.sichere_anhaenge`).
   */
  attachments?: string[];
};

/**
 * Vorschautext einer Nachricht, die nur aus Bildern besteht. Der Server legt
 * dieses sprachneutrale Kürzel ab (er kennt die Sprache des Betrachters
 * nicht); die Worte macht die Oberfläche.
 *
 * Muss mit `NUR_ANHANG_TEXT` in
 * `apps/api/.../channel_manager/common.py` übereinstimmen.
 */
export const NUR_ANHANG_TEXT = "[attachment]";

/** Thread-Liste (default: aktive). */
export async function listInboxThreads(
  opts: { unassigned?: boolean; status?: "active" | "archived" | "trashed" } = {},
): Promise<Result<{ items: InboxThread[]; total: number }>> {
  const params = new URLSearchParams();
  if (opts.unassigned) params.set("unassigned", "true");
  if (opts.status && opts.status !== "active") params.set("status", opts.status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return call(`/inbox${qs}`);
}

/** Nachrichten eines Threads (chronologisch). */
export async function getInboxMessages(
  threadId: string,
): Promise<Result<{ items: InboxMessage[]; total: number }>> {
  return call(`/inbox/${encodeURIComponent(threadId)}/messages`);
}

/**
 * Konversation als gelesen markieren.
 *
 * Gehört zum ÖFFNEN, nicht zu einer eigenen Aktion: die App zeigte den Verlauf
 * an und ließ den Thread trotzdem ungelesen — der Zähler blieb stehen, bis
 * jemand am Rechner denselben Thread aufmachte. Der Server hängt daran zwei
 * Dinge: `is_read` und `read_at`, und nur beide zusammen tragen den Lesestand
 * (`inbox.service._ist_gelesen`).
 */
export async function markInboxThreadRead(
  threadId: string,
): Promise<Result<void>> {
  return call(`/inbox/${encodeURIComponent(threadId)}/flags`, {
    method: "PUT",
    body: { is_read: true },
  });
}

/** Antwort an den Gast senden (zurück an die OTA). */
export async function sendInboxMessage(
  threadId: string,
  message: string,
): Promise<Result<InboxMessage>> {
  return call(`/inbox/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: { message },
  });
}
