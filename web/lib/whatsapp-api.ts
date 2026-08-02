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
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
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
