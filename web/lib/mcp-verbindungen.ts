"use server";

// MCP-Verbindungen: der Betrieb erlaubt einem KI-Assistenten (claude.ai) den
// LESENDEN Zugriff auf Kalender, Buchungen, Notizen und Posteingang.
// Server-Actions gegen den FastAPI-mcp-Slice (0385).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export type McpVerbindung = {
  client_id: string;
  // Der HOST der client_id-URL — die einzige geprüfte Identität des Clients.
  // Bewusst NICHT der selbst-behauptete Name aus dem Client-Dokument.
  host: string;
  scope: string;
  erteilt_am: string;
};

export async function listeVerbindungen(): Promise<Result<McpVerbindung[]>> {
  const res = await call<{ items: McpVerbindung[] }>("/mcp/verbindungen");
  return res.ok ? { ok: true, data: res.data.items } : res;
}

export async function trenneVerbindung(clientId: string): Promise<Result<null>> {
  return call<null>(
    `/mcp/verbindungen?client_id=${encodeURIComponent(clientId)}`,
    { method: "DELETE" },
  );
}

export type ZustimmungEingabe = {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  state: string;
  resource: string;
};

// Erteilt die Zustimmung und liefert das Ziel, auf das der Browser danach
// weiterleiten muss (dort hängt der Autorisierungscode dran).
export async function erteileZustimmung(
  eingabe: ZustimmungEingabe,
): Promise<Result<{ weiter_zu: string }>> {
  return call<{ weiter_zu: string }>("/mcp/consent", {
    method: "POST",
    body: eingabe,
  });
}
