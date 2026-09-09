"use server";

// WhatsApp-Kanal: Server-Actions gegen den FastAPI-whatsapp-Slice
// (/api/v1/whatsapp). Bidirektional über die Meta WhatsApp Cloud API; im
// Sandbox-Modus über den lokalen Mock. Business-Logik bleibt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type WhatsAppConversation = {
  id: string;
  wa_phone: string;
  guest_name: string | null;
  /** Bild des VERKNÜPFTEN Gastes — WhatsApp selbst liefert keines (die Cloud
   *  API gibt das Profilbild nicht heraus). `null` = Initialen anzeigen. */
  guest_avatar_url: string | null;
  reservation_id: string | null;
  last_message: string | null;
  last_at: string | null;
  is_read: boolean;
};

export type WhatsAppMessage = {
  id: string | null;
  direction: "in" | "out";
  body: string;
  status: string;
  sent_at: string | null;
};

export type WhatsAppStatus = {
  configured: boolean;
  sandbox: boolean;
  phone_number_id_set: boolean;
};

/** Kanal-Zustand DIESES Betriebs (whatsapp_account), nicht die Serverkonfig.
 *  Enthält bewusst kein Zugangstoken. */
export type WhatsAppOnboardingStatus = {
  connected: boolean;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  // null = Meta hat keinen Zustand geliefert; NICHT als „darf senden" deuten.
  can_send_message: boolean | null;
  // z. B. „141006: There is an error with the payment method."
  send_block_reason: string | null;
  quality_rating: string | null;
  messaging_limit_tier: string | null;
  status: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/whatsapp${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

/** Konfig-Status (white-label, kein Token): konfiguriert / Sandbox aktiv?
 *  ACHTUNG: das ist die SERVER-Konfiguration, nicht der Kanal eines Betriebs.
 *  Für „hat dieser Betrieb eine Nummer verbunden?" → getWhatsAppOnboardingStatus. */
export async function getWhatsAppStatus(): Promise<Result<WhatsAppStatus>> {
  return call<WhatsAppStatus>("/status");
}

/** Adresse von Metas gehosteter Signup-Seite. App- und Konfigurations-ID
 *  bleiben serverseitig; `available: false` heißt, die Konfiguration fehlt noch. */
export async function getWhatsAppStartLink(): Promise<
  Result<{ available: boolean; url: string | null; reason: string | null }>
> {
  return call<{ available: boolean; url: string | null; reason: string | null }>(
    "/onboarding/startlink",
  );
}

/** Embedded-Signup abschließen: den Code von Meta gegen den Kanal eintauschen.
 *  Der Code lebt nur ~30 Sekunden, also direkt nach der Rückleitung aufrufen. */
export async function connectWhatsApp(
  code: string,
): Promise<Result<WhatsAppOnboardingResult>> {
  return call<WhatsAppOnboardingResult>("/onboarding/verbinden", {
    method: "POST",
    body: { code },
  });
}

/** Den verbundenen Kanal lösen — der Weg zurück zu einer anderen Nummer.
 *  Meldet serverseitig zusätzlich Metas Webhook-Abo dieser WABA ab und
 *  entfernt die Zeile samt Zugangstoken. Danach zeigt die Seite wieder
 *  „Nummer verbinden". */
export async function disconnectWhatsApp(): Promise<Result<WhatsAppOnboardingStatus>> {
  return call<WhatsAppOnboardingStatus>("/onboarding/trennen", { method: "POST" });
}

export type WhatsAppOnboardingResult = {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  can_send_message: boolean | null;
  send_block_reason: string | null;
  templates: {
    angelegt: string[];
    uebersprungen: string[];
    fehler: string[];
  };
};

/** Kanal-Zustand des eingeloggten Betriebs: verbundene Nummer, Sendebereitschaft,
 *  Sperrgrund. Quelle ist whatsapp_account, also die eigene Nummer — nicht die
 *  global konfigurierte. */
export async function getWhatsAppOnboardingStatus(): Promise<
  Result<WhatsAppOnboardingStatus>
> {
  return call<WhatsAppOnboardingStatus>("/onboarding/status");
}

/** WhatsApp-Konversationen des Tenants. */
export async function listWhatsAppConversations(): Promise<
  Result<{ items: WhatsAppConversation[]; total: number }>
> {
  return call<{ items: WhatsAppConversation[]; total: number }>("/conversations");
}

/** Nachrichtenverlauf einer WhatsApp-Konversation. */
export async function listWhatsAppMessages(
  conversationId: string,
): Promise<Result<{ items: WhatsAppMessage[]; total: number }>> {
  return call<{ items: WhatsAppMessage[]; total: number }>(
    `/conversations/${conversationId}/messages`,
  );
}

/** WhatsApp-Nachricht senden (bestehende Konversation oder neue Nummer). */
export async function sendWhatsApp(input: {
  conversation_id?: string;
  to_phone?: string;
  body: string;
}): Promise<Result<WhatsAppMessage>> {
  return call<WhatsAppMessage>("/send", { method: "POST", body: input });
}

export type WhatsAppTemplateComponent = {
  type: string;
  text?: string;
  example?: { body_text?: string[][] };
};

export type WhatsAppTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: WhatsAppTemplateComponent[];
  rejected_reason?: string | null;
  /** In myNextDays ausgeblendet — bei Meta besteht die Vorlage weiter. */
  hidden?: boolean;
};

/** Vorlagen der WABA DIESES Betriebs, mit Metas Prüfstatus. Quelle ist Meta,
 *  nicht unsere DB — ein gespiegelter Status driftet. */
export async function listWhatsAppTemplates(
  mitAusgeblendeten = false,
  frisch = false,
): Promise<Result<{ items: WhatsAppTemplate[] }>> {
  const q = new URLSearchParams();
  if (mitAusgeblendeten) q.set("mit_ausgeblendeten", "true");
  // Nach einer eigenen Änderung den Zwischenstand des Servers überspringen:
  // die API läuft mit mehreren Workern, und der Worker, der die Liste liefert,
  // muss nicht der sein, der die Änderung geschrieben hat.
  if (frisch) q.set("frisch", "true");
  const query = q.toString();
  return call<{ items: WhatsAppTemplate[] }>(
    `/templates${query ? `?${query}` : ""}`,
  );
}

/** Vorlage in myNextDays aus- oder wieder einblenden. Bei Meta bleibt sie
 *  bestehen — das ist der Unterschied zum Löschen. */
export async function hideWhatsAppTemplate(
  name: string,
  language: string,
  hidden: boolean,
): Promise<Result<unknown>> {
  return call<unknown>(
    `/templates/${encodeURIComponent(name)}/ausblenden`,
    { method: "POST", body: { language, hidden } },
  );
}

/** Den myNextDays-Vorlagensatz in die WABA des Betriebs ausrollen. Idempotent:
 *  vorhandene Vorlagen werden übersprungen, abgelehnte einzeln gemeldet. */
export async function rolloutWhatsAppTemplates(): Promise<
  Result<{ angelegt: string[]; uebersprungen: string[]; fehler: string[] }>
> {
  return call<{ angelegt: string[]; uebersprungen: string[]; fehler: string[] }>(
    "/templates/rollout",
    { method: "POST" },
  );
}


/** Eine eigene Vorlage anlegen. Meta prüft sie asynchron — sie erscheint
 *  danach mit Status PENDING in der Liste.
 *
 *  `body` trägt UNSERE Platzhalter ({{guest_first_name}}); Metas positionelle
 *  Form und die Beispielwerte, die Meta zu jedem Platzhalter verlangt, entstehen
 *  serverseitig. */
export async function createWhatsAppTemplate(input: {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  body: string;
  footer?: string | null;
}): Promise<Result<unknown>> {
  return call<unknown>("/templates/neu", { method: "POST", body: input });
}

/** Text einer Vorlage ändern. Name und Sprache sind bei Meta unveränderlich —
 *  sie gehen nur mit, damit der Server die Feld-Zuordnung wiederfindet. Die
 *  Fußzeile muss mitgeschickt werden, weil Metas Update alle Komponenten
 *  ersetzt. */
export async function updateWhatsAppTemplate(
  templateId: string,
  input: {
    name: string;
    language: string;
    body: string;
    footer?: string | null;
  },
): Promise<Result<unknown>> {
  return call<unknown>(`/templates/${encodeURIComponent(templateId)}`, {
    method: "POST",
    body: input,
  });
}

/** Vorlage löschen. Mit `templateId` nur diese Sprachfassung — ohne sie
 *  löscht Meta ALLE Fassungen dieses Namens. */
export async function deleteWhatsAppTemplate(
  name: string,
  templateId?: string,
): Promise<Result<unknown>> {
  const q = new URLSearchParams({ name });
  if (templateId) q.set("template_id", templateId);
  return call<unknown>(`/templates?${q.toString()}`, { method: "DELETE" });
}

/** Eine von Meta geprüfte Vorlage senden — der einzige Weg AUSSERHALB des
 *  24-Stunden-Fensters. Die Werte der Platzhalter setzt der Server aus der
 *  Reservierung des Chats; die Oberfläche wählt nur die Vorlage. */
export async function sendWhatsAppTemplate(input: {
  conversation_id?: string;
  to_phone?: string;
  template_name: string;
  language_code: string;
}): Promise<Result<WhatsAppMessage>> {
  return call<WhatsAppMessage>("/send-template", { method: "POST", body: input });
}

/** KI-Antwortvorschlag für einen WhatsApp-Verlauf. Wird NUR vorgeschlagen,
 *  nicht gesendet — schreiben tut ein Mensch. `sources` nennt die Fakten aus
 *  der Wissensdatenbank, auf die sich der Vorschlag stützen konnte. */
export async function getWhatsAppAiReply(
  conversationId: string,
): Promise<Result<{ reply: string; sources: string[] }>> {
  return call<{ reply: string; sources: string[] }>(
    `/conversations/${conversationId}/ai-reply`,
    { method: "POST", body: {} },
  );
}
