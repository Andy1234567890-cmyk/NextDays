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
  ota_name: string | null;
  ota_reservation_code: string | null;
  guest_name: string | null;
  guest_email: string | null;
  status: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  last_message: string | null;
  updated_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
};

export type InboxMessage = {
  id: string | null;
  message: string;
  sender: "guest" | "property" | "note";
  sent_at: string | null;
  author_name?: string | null;
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

/** OTA-Gäste-Threads des aktuellen Tenants (aktiv oder archiviert). */
export async function listInboxThreads(
  opts: { unassigned?: boolean; archived?: boolean } = {},
): Promise<Result<{ items: InboxThread[]; total: number }>> {
  const params = new URLSearchParams();
  if (opts.unassigned) params.set("unassigned", "true");
  if (opts.archived) params.set("archived", "true");
  const qs = params.toString() ? `?${params.toString()}` : "";
  return call<{ items: InboxThread[]; total: number }>(qs);
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

/** Nachrichtenverlauf einer Konversation (live aus Channex). */
export async function getInboxMessages(
  threadId: string,
): Promise<Result<{ items: InboxMessage[]; total: number }>> {
  return call<{ items: InboxMessage[]; total: number }>(`/${threadId}/messages`);
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
export type Automation = {
  id: string;
  name: string;
  trigger: string;
  offset_days: number;
  template_id: string | null;
  message: string | null;
  is_active: boolean;
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
