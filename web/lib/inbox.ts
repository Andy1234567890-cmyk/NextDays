"use server";

// Posteingang: Server-Actions gegen den FastAPI-inbox-Slice (/api/v1/inbox).
// Threads werden aus importierten OTA-Buchungen abgeleitet (Portal, Gast,
// Reservierungsbezug). Business-Logik im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type InboxThread = {
  id: string;
  channex_booking_id: string | null;
  reservation_id: string | null;
  guest_id: string | null; // verknüpfter Gast (Resolver) → Link zur Gästekarte
  property_id: string | null;    // zugeordnetes Objekt (Filter/Anzeige)
  property_title: string | null;
  ota_name: string | null;       // Kanal (myBestDays, Booking.com, Airbnb, …)
  ota_reservation_code: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
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
  // "event" = Ereignis der Reservierung (Buchungseingang, Statuswechsel) im
  // selben Strang wie die Nachrichten — wie bei Lodgify/Hostaway.
  sender: "guest" | "property" | "note" | "event";
  sent_at: string | null;
  author_name?: string | null;
  /** Nur bei sender="event": Schlüssel der Kopfzeile (i18n). */
  event_title?: string | null;
  /** Nur bei sender="event": roher Statuswert ("modified" | "cancelled"). */
  event_detail?: string | null;
  /**
   * Nur bei sender="event": aufklappbare Angaben. `label` ist ein i18n-Kürzel,
   * `value` steht unverändert so da, wie das Portal es geliefert hat.
   */
  event_facts?: { label: string; value: string }[];
  /** Nur bei sender="event": Herkunftskanal (BookingCom, Airbnb …). */
  event_channel?: string | null;
};

export type TeamMember = { id: string; name: string; email: string | null };

export type ScheduledMessage = {
  id: string;
  thread_id: string;
  body: string;
  send_at: string;
  status: string;
};

export type ReservationDetail = {
  listing_name: string | null;
  listing_photo: string | null;
  address: string | null;
  rental_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_location: string | null;
  adults: number | null;
  children: number | null;
  nights: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  currency: string | null;
  status: string | null;
  ota_name: string | null;
  ota_reservation_code: string | null;
  check_in: string | null;
  check_out: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  note: string | null;
  is_starred: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/inbox${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

export type InboxStatus = "active" | "archived" | "trashed";

/** OTA-Gäste-Threads des aktuellen Tenants (aktiv | archiviert | Papierkorb). */
export async function listInboxThreads(
  opts: { unassigned?: boolean; status?: InboxStatus } = {},
): Promise<Result<{ items: InboxThread[]; total: number }>> {
  const params = new URLSearchParams();
  if (opts.unassigned) params.set("unassigned", "true");
  if (opts.status && opts.status !== "active") params.set("status", opts.status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return call<{ items: InboxThread[]; total: number }>(qs);
}

/** Lebenszyklus setzen: active (wiederherstellen) | archived | trashed | deleted. */
export async function setInboxStatus(
  threadId: string,
  status: "active" | "archived" | "trashed" | "deleted",
): Promise<Result<void>> {
  return call<void>(`/${threadId}/status`, { method: "PUT", body: { status } });
}

/** Team-Benutzer des Tenants (mögliche Bearbeiter). */
export async function listTeam(): Promise<
  Result<{ items: TeamMember[]; total: number }>
> {
  return call<{ items: TeamMember[]; total: number }>("/team");
}

/** Konversation einem Benutzer zuweisen (null hebt auf). */
export async function assignThread(
  threadId: string,
  userId: string | null,
): Promise<Result<void>> {
  return call<void>(`/${threadId}/assign`, {
    method: "PUT",
    body: { user_id: userId },
  });
}

/**
 * Korrektur: Thread einem (anderen) Gast zuordnen. guestId=null legt einen Gast
 * aus den Thread-Kontaktdaten an (Resolver). Erfordert INBOX_MANAGE_CONFIG.
 */
export async function linkThreadGuest(
  threadId: string,
  guestId: string | null,
): Promise<Result<{ guest_id: string | null }>> {
  return call<{ guest_id: string | null }>(`/${threadId}/guest`, {
    method: "PUT",
    body: { guest_id: guestId },
  });
}

/** Interne Notiz (gelb) in den Verlauf legen. */
export async function addNote(
  threadId: string,
  body: string,
): Promise<Result<InboxMessage>> {
  return call<InboxMessage>(`/${threadId}/notes`, {
    method: "POST",
    body: { body },
  });
}

/** Anstehende geplante Nachrichten einer Konversation. */
export async function listScheduled(
  threadId: string,
): Promise<Result<{ items: ScheduledMessage[]; total: number }>> {
  return call<{ items: ScheduledMessage[]; total: number }>(`/${threadId}/scheduled`);
}

/** Manuelle Nachricht zeitversetzt planen. */
export async function scheduleMessage(
  threadId: string,
  body: string,
  sendAt: string,
): Promise<Result<ScheduledMessage>> {
  return call<ScheduledMessage>(`/${threadId}/scheduled`, {
    method: "POST",
    body: { body, send_at: sendAt },
  });
}

/** Geplante Nachricht abbrechen. */
export async function cancelScheduled(scheduledId: string): Promise<Result<void>> {
  return call<void>(`/scheduled/${scheduledId}`, { method: "DELETE" });
}

/** Massenaktion: Threads ab Datum als gelesen/archiviert markieren. */
export async function bulkUpdate(
  action: "read" | "archived",
  before: string,
): Promise<Result<{ updated: number }>> {
  return call<{ updated: number }>("/bulk-update", {
    method: "POST",
    body: { action, before },
  });
}

/**
 * Nachrichtenverlauf einer Konversation — live vom Portal, nicht aus unserer DB.
 *
 * `unavailable` benennt, warum der Portal-Chat gerade nichts liefert
 * ("chat_app_missing": Chat für dieses Objekt bei den Portalen nicht
 * freigeschaltet). Die Ereignisse der Buchung stehen trotzdem im Verlauf.
 */
export type InboxMessagesResult = {
  items: InboxMessage[];
  total: number;
  unavailable?: string | null;
};

export async function getInboxMessages(
  threadId: string,
): Promise<Result<InboxMessagesResult>> {
  return call<InboxMessagesResult>(`/${threadId}/messages`);
}

/** Antwort an den Gast senden (zurück an die OTA). */
export async function sendInboxMessage(
  threadId: string,
  message: string,
): Promise<Result<InboxMessage>> {
  return call<InboxMessage>(`/${threadId}/messages`, {
    method: "POST",
    body: { message },
  });
}

/** Reservierungs-Kontext rechts neben dem Chat. */
export async function getInboxReservation(
  threadId: string,
): Promise<Result<ReservationDetail>> {
  return call<ReservationDetail>(`/${threadId}/reservation`);
}

/** Konversations-Flags setzen (Favorit/Notiz/Lesen/Archiv/Erinnerung). */
export async function updateThreadFlags(
  threadId: string,
  input: {
    is_starred?: boolean;
    note?: string;
    is_read?: boolean;
    is_archived?: boolean;
    remind_at?: string;
  },
): Promise<Result<void>> {
  return call<void>(`/${threadId}/flags`, { method: "PUT", body: input });
}

/** KI-Antwortvorschlag (Groq) aus Verlauf + Buchungskontext. */
export async function getAiReply(
  threadId: string,
): Promise<Result<{ reply: string; sources: string[] }>> {
  return call<{ reply: string; sources: string[] }>(`/${threadId}/ai-reply`, {
    method: "POST",
    body: {},
  });
}

// --- Vorlagen ---------------------------------------------------------------
export type MessageTemplate = { id: string; title: string; body: string };

export async function listTemplates(): Promise<
  Result<{ items: MessageTemplate[]; total: number }>
> {
  return call<{ items: MessageTemplate[]; total: number }>("/templates");
}

export async function createTemplate(input: {
  title: string;
  body: string;
}): Promise<Result<MessageTemplate>> {
  return call<MessageTemplate>("/templates", { method: "POST", body: input });
}

export async function updateTemplate(
  id: string,
  input: { title: string; body: string },
): Promise<Result<MessageTemplate>> {
  return call<MessageTemplate>(`/templates/${id}`, { method: "PUT", body: input });
}

export async function deleteTemplate(id: string): Promise<Result<void>> {
  return call<void>(`/templates/${id}`, { method: "DELETE" });
}

// --- KI-Einstellungen -------------------------------------------------------
export type AiSettings = {
  tone: string;
  language: string;
  signature: string | null;
  extra_prompt: string | null;
  auto_suggest: boolean;
};

export async function getAiSettings(): Promise<Result<AiSettings>> {
  return call<AiSettings>("/ai-settings");
}

export async function saveAiSettings(
  input: AiSettings,
): Promise<Result<AiSettings>> {
  return call<AiSettings>("/ai-settings", { method: "PUT", body: input });
}

// --- Automatisierungen ------------------------------------------------------
/** Auslöser einer Automatisierung. `message_received` (Abwesenheitsantwort)
 *  hängt an keinem Datum der Reservierung, sondern am Eingang einer Nachricht —
 *  dort sind anchor/offset_days/send_time bedeutungslos und stattdessen die
 *  window_*-Felder maßgeblich. */
export type AutomationTrigger =
  | "booking_new"
  | "before_checkin"
  | "after_checkout"
  | "message_received";

export type Automation = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  // anchor: Bezugsdatum (arrival|departure|booking); offset_days = vorzeichen-
  // behaftetes Tagesdelta; send_time "HH:MM"; property_ids/channels leer = alle.
  anchor: string;
  offset_days: number;
  send_time: string | null;
  property_ids: string[];
  channels: string[];
  template_id: string | null;
  message: string | null;
  is_active: boolean;
  /** Sendezeit in der Zeitzone des Objekts auflösen statt in UTC. Ohne
   *  hinterlegte Zeitzone plant der Server für dieses Objekt NICHT. */
  use_property_timezone: boolean;
  /** Nur message_received: nur die erste Gastnachricht des Threads. */
  only_first_message: boolean;
  /** Nur message_received: Wochentage, an denen ausgelöst werden darf
   *  (0 = Montag … 6 = Sonntag). Leer = alle Tage. */
  window_days: number[];
  /** Nur message_received: Zeitfenster "HH:MM". Ende vor Anfang = über
   *  Mitternacht (22:00–06:00). Beide oder keines. */
  window_from: string | null;
  window_to: string | null;
};

export type AutomationInput = Omit<Automation, "id">;

export async function listAutomations(): Promise<
  Result<{ items: Automation[]; total: number }>
> {
  return call<{ items: Automation[]; total: number }>("/automations");
}

export async function createAutomation(
  input: AutomationInput,
): Promise<Result<Automation>> {
  return call<Automation>("/automations", { method: "POST", body: input });
}

export async function updateAutomation(
  id: string,
  input: AutomationInput,
): Promise<Result<Automation>> {
  return call<Automation>(`/automations/${id}`, { method: "PUT", body: input });
}

export async function deleteAutomation(id: string): Promise<Result<void>> {
  return call<void>(`/automations/${id}`, { method: "DELETE" });
}

// --- Platzhalter (Felder) -----------------------------------------------------
/** Ein Platzhalter, der in Vorlagen und Automationen benutzt werden kann.
 *  `key` ist sprachneutral und stabil (`{{guest_name}}`); die Beschriftung
 *  kommt aus den Sprachdateien (`inbox.field_<key>`), damit eine Vorlage einen
 *  Sprachwechsel der Oberfläche unbeschadet übersteht. */
export type FieldEntry = {
  key: string;
  group: "guest" | "reservation" | "property" | "company";
};

export async function listFields(): Promise<Result<{ items: FieldEntry[] }>> {
  return call<{ items: FieldEntry[] }>("/fields");
}

/** Text mit den Daten DIESER Konversation auflösen — Vorschau beim Einfügen
 *  einer Vorlage, damit niemand `{{guest_name}}` an einen Gast schickt.
 *  Fehlt der Wert eines benutzten Feldes, antwortet der Server mit 422 und
 *  nennt das Feld; dann steht die Reservierung unvollständig da. */
export async function renderForThread(
  threadId: string,
  text: string,
): Promise<Result<{ text: string }>> {
  return call<{ text: string }>(`/${threadId}/render`, {
    method: "POST",
    body: { text },
  });
}

// --- Anhänge ------------------------------------------------------------------
export type Attachment = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  /** Befristet signierte Download-URL (privater Bucket). */
  url: string | null;
  created_at: string | null;
  /** Gesetzt, sobald an den Kanal übergeben. NULL = liegt nur bei uns. */
  sent_at: string | null;
  /** Warum der Kanal die Datei abgelehnt hat (Airbnb nimmt kein PDF). */
  channel_error: string | null;
};

export async function listAttachments(
  threadId: string,
): Promise<Result<{ items: Attachment[]; total: number }>> {
  return call<{ items: Attachment[]; total: number }>(`/${threadId}/attachments`);
}

export async function deleteAttachment(id: string): Promise<Result<void>> {
  return call<void>(`/attachments/${id}`, { method: "DELETE" });
}

// --- KI-Wissensdatenbank -------------------------------------------------------
export type KnowledgeFact = {
  id: string;
  /** null = gilt betriebsweit, sonst nur für dieses Objekt. */
  property_id: string | null;
  property_title: string | null;
  fact: string;
  source: "manual" | "document" | "message";
  source_ref: string | null;
  updated_at: string | null;
};

export async function listKnowledge(
  propertyId?: string,
): Promise<Result<{ items: KnowledgeFact[]; total: number }>> {
  const q = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  return call<{ items: KnowledgeFact[]; total: number }>(`/knowledge${q}`);
}

export async function createKnowledge(input: {
  property_id: string | null;
  fact: string;
}): Promise<Result<KnowledgeFact>> {
  return call<KnowledgeFact>("/knowledge", { method: "POST", body: input });
}

export async function updateKnowledge(
  id: string,
  input: { property_id: string | null; fact: string },
): Promise<Result<KnowledgeFact>> {
  return call<KnowledgeFact>(`/knowledge/${id}`, { method: "PUT", body: input });
}

export async function deleteKnowledge(id: string): Promise<Result<void>> {
  return call<void>(`/knowledge/${id}`, { method: "DELETE" });
}

/** Datei an eine Konversation hängen (multipart) und an den Kanal übergeben.
 *  Der Upload gelingt auch, wenn der Kanal die Datei ablehnt — dann trägt der
 *  Anhang `channel_error` und `sent_at` bleibt leer. */
export async function uploadAttachment(
  threadId: string,
  file: File,
  message?: string,
): Promise<Result<Attachment>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ filename: file.name });
  if (message) params.set("message", message);
  try {
    const res = await fetch(
      `${base}/api/v1/inbox/${threadId}/attachments?${params.toString()}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as Attachment };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}
