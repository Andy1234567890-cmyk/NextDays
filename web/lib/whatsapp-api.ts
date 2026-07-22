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

/** Konfig-Status (white-label, kein Token): konfiguriert / Sandbox aktiv? */
export async function getWhatsAppStatus(): Promise<Result<WhatsAppStatus>> {
  return call<WhatsAppStatus>("/status");
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
