// Nachrichten des Gasts mit seinem Gastgeber — gegen den FastAPI-Slice
// `guest_messages` (/api/v1/guest-messages).
//
// EIN ANDERER TOPF ALS DER POSTEINGANG DES BETRIEBS: Der Betrieb liest im PMS
// den `inbox`-Slice (OTA-Verläufe von Booking/Airbnb, Anfragen, Marktplatz).
// Hier geht es um den Chat zu einer Buchung über myBestDays — eigene Tabelle,
// eigene Auth-Welt (`portal_guests`, Gast-JWT), eigene Endpunkte. Wer die zwei
// verwechselt, baut dem Gast den Kanal des Betriebs ein.
//
// Was der Server bestimmt und der Client NICHT mitschickt:
//   * `sender` — serverseitig immer 'guest' (Wurzel 3/6).
//   * `tenant_id`/`property_id` beim Anlegen — abgeleitet aus der Reservierung.
//   * Sanitisierung und Längenkappung des Textes.
import { guestCall, type Result } from "./guestApi";

export type GuestThread = {
  id: string;
  reservation_id: string;
  property_id: string;
  property_title: string | null;
  check_in: string | null;
  check_out: string | null;
  last_message_at: string | null;
  /** Ungelesene Nachrichten DES GASTGEBERS (Gast-Sicht). */
  unread_count: number;
  created_at: string;
};

export type GuestMessage = {
  id: string;
  thread_id: string;
  /** 'guest' = ich, 'host' = der Gastgeber. */
  sender: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type GuestThreadDetail = {
  id: string;
  reservation_id: string;
  property_id: string;
  last_message_at: string | null;
  messages: GuestMessage[];
};

export async function listGuestThreads(): Promise<
  Result<{ threads: GuestThread[] }>
> {
  return guestCall("/guest-messages/threads");
}

/**
 * Einen Thread mit seinen Nachrichten holen.
 *
 * ACHTUNG, Nebenwirkung mit Absicht: Dieser Aufruf markiert die Nachrichten des
 * Gastgebers als gelesen (so ist der Endpunkt gebaut). Er darf deshalb NICHT
 * zum Vorladen benutzt werden — sonst gilt gelesen, was niemand gesehen hat.
 */
export async function getGuestThread(
  threadId: string,
): Promise<Result<GuestThreadDetail>> {
  return guestCall(`/guest-messages/threads/${threadId}`);
}

/**
 * Thread zu einer Buchung anlegen — idempotent: existiert er schon, kommt er
 * zurück (Wurzel 2). Deshalb ist „Nachricht schreiben" beim Gast immer derselbe
 * Aufruf, ohne vorher zu prüfen.
 */
export async function createGuestThread(
  reservationId: string,
): Promise<Result<GuestThreadDetail>> {
  return guestCall("/guest-messages/threads", {
    method: "POST",
    body: { reservation_id: reservationId },
  });
}

export async function sendGuestMessage(
  threadId: string,
  body: string,
): Promise<Result<GuestMessage>> {
  return guestCall(`/guest-messages/threads/${threadId}/messages`, {
    method: "POST",
    body: { body },
  });
}
