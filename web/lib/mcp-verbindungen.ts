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
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
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

export type McpZugriff = {
  host: string;
  werkzeug: string;
  ziel_id: string | null;
  anzahl: number;
  scopes: string;
  erfolg: boolean;
  zeitpunkt: string;
};

// Das Zugriffsprotokoll (0388). Der Betrieb braucht es, um eine Auskunft nach
// Art. 15 DSGVO erteilen zu können — ohne Aufzeichnung wäre die Antwort auf
// „wer hat meine Daten bekommen?" ein Achselzucken.
export async function listeZugriffe(): Promise<Result<McpZugriff[]>> {
  const res = await call<{ items: McpZugriff[] }>("/mcp/zugriffe");
  return res.ok ? { ok: true, data: res.data.items } : res;
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

/** Umfang einer BESTEHENDEN Verbindung ändern (0389).
 *
 * Zwei Achsen: `freitexte` (Notizen, Nachrichteninhalte) und `schreiben`
 * (Änderungen am operativen Geschäft). Bis dahin war der Umfang nur beim
 * Verbinden wählbar — wer mehr brauchte, musste trennen und neu verbinden,
 * während der Hinweis in den Werkzeugen auf „Konto → Verbindungen" verwies.
 *
 * `schreiben` bleibt weg, wenn nur die Freitexte gemeint sind: Der Server
 * führt die andere Achse dann unverändert weiter, statt sie stillschweigend
 * zurückzusetzen.
 *
 * Jedes ABSCHALTEN löscht serverseitig die Erneuerungs-Token, damit es sofort
 * wirkt: Der Scope steht im Zugangstoken und gälte sonst noch bis zu eine
 * Stunde weiter. */
export async function setzeUmfang(
  clientId: string,
  freitexte: boolean,
  schreiben?: boolean,
): Promise<Result<{ scope: string }>> {
  return call<{ scope: string }>("/mcp/verbindungen", {
    method: "PATCH",
    body: { client_id: clientId, freitexte, schreiben },
  });
}
