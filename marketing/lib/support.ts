// Zugriff auf den öffentlichen Support-Chat (/api/v1/support/public).
//
// Der Besucher hat kein Konto: Schlüssel zum eigenen Verlauf ist ein
// Zufallstoken, das die API beim Eröffnen genau einmal zurückgibt. Es liegt im
// localStorage — deshalb hier auch die einzige Stelle, die es liest/schreibt.
import { API_BASE } from "@/lib/config";

const TOKEN_KEY = "nd_support_token";

export type SupportMessage = {
  id: string;
  author_kind: "reporter" | "agent";
  body: string;
  created_at: string;
  client_msg_id?: string | null;
};

export type SupportConversation = {
  ticket_id: string;
  status: string;
  messages: SupportMessage[];
  token?: string | null;
};

export function gespeichertesToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function tokenSpeichern(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function tokenVerwerfen(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // Der Detailtext der API ist für Besucher gedacht (422/429/404) — er wird
    // im Widget angezeigt, damit „nichts passiert" nicht der Regelfall ist.
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      detail = "";
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function chatEroeffnen(daten: {
  name: string;
  email: string;
  phone?: string;
  body: string;
  clientMsgId: string;
}): Promise<SupportConversation> {
  const res = await fetch(`${API_BASE}/support/public/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: daten.name,
      email: daten.email,
      phone: daten.phone || null,
      body: daten.body,
      client_msg_id: daten.clientMsgId,
    }),
  });
  const konversation = await json<SupportConversation>(res);
  if (konversation.token) tokenSpeichern(konversation.token);
  return konversation;
}

export async function chatLaden(token: string): Promise<SupportConversation> {
  return json<SupportConversation>(
    await fetch(`${API_BASE}/support/public/${encodeURIComponent(token)}`),
  );
}

export async function chatAntworten(
  token: string,
  body: string,
  clientMsgId: string,
): Promise<SupportMessage> {
  return json<SupportMessage>(
    await fetch(`${API_BASE}/support/public/${encodeURIComponent(token)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, client_msg_id: clientMsgId }),
    }),
  );
}
