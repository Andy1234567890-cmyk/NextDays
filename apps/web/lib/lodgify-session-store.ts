// Kurzlebiger, serverseitiger Zwischenspeicher für den Lodgify-Umzug:
//   1) Der Umzug-Tab erzeugt einen Kopplungscode (an den NextDays-User gebunden).
//   2) Die Browser-Extension schickt Code + Lodgify-Cookies → hier abgelegt.
//   3) Der Umzug-Tab holt die Cookies (per User-Schlüssel) und importiert.
//
// In-Memory mit TTL — bewusst NICHT persistent: Session-Cookies sollen so kurz
// wie möglich liegen. Für Mehr-Instanz-Prod später durch Redis ersetzen (dann
// überleben Kopplung/Session auch einen Instanzwechsel). Für Dev/Single-Instance
// ausreichend. Cookies werden nach dem Import sofort gelöscht (consumeSession).
import type { SessionCookie } from "@/lib/lodgify-import";

type PairingEntry = { tenantKey: string; expires: number };
type SessionEntry = { cookies: SessionCookie[]; expires: number };

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 min, um die Extension zu koppeln
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min, um den Import auszulösen

// Globale Maps (überleben Hot-Reload im Dev via globalThis).
const g = globalThis as unknown as {
  __lgPairings?: Map<string, PairingEntry>;
  __lgSessions?: Map<string, SessionEntry>;
};
const pairings = (g.__lgPairings ??= new Map());
const sessions = (g.__lgSessions ??= new Map());

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of pairings) if (v.expires < now) pairings.delete(k);
  for (const [k, v] of sessions) if (v.expires < now) sessions.delete(k);
}

/** Kopplungscode für einen NextDays-User erzeugen (kurzlebig). `tenantKey` ist
 *  ein stabiler, nicht erratbarer Schlüssel des Users (z. B. sein Access-Token
 *  bzw. dessen Hash) — NICHT die Objekte, nur zum Zuordnen der Cookies. */
export function createPairing(tenantKey: string): string {
  sweep();
  const code = randomCode();
  pairings.set(code, { tenantKey, expires: Date.now() + PAIRING_TTL_MS });
  return code;
}

/** Kopplungscode einlösen → zugehöriger User-Schlüssel (einmalig verwendbar). */
export function consumePairing(code: string): string | null {
  sweep();
  const entry = pairings.get(code);
  if (!entry) return null;
  pairings.delete(code); // einmalig
  if (entry.expires < Date.now()) return null;
  return entry.tenantKey;
}

/** Von der Extension gelieferte Cookies für den User ablegen. */
export function putSession(tenantKey: string, cookies: SessionCookie[]): void {
  sweep();
  sessions.set(tenantKey, {
    cookies,
    expires: Date.now() + SESSION_TTL_MS,
  });
}

/** Cookies des Users holen UND löschen (einmalige Verwendung für den Import). */
export function consumeSession(tenantKey: string): SessionCookie[] | null {
  sweep();
  const entry = sessions.get(tenantKey);
  if (!entry) return null;
  sessions.delete(tenantKey);
  if (entry.expires < Date.now()) return null;
  return entry.cookies;
}

/** Nur prüfen, ob eine Session bereitliegt (ohne sie zu verbrauchen). */
export function hasSession(tenantKey: string): boolean {
  sweep();
  const entry = sessions.get(tenantKey);
  return !!entry && entry.expires >= Date.now();
}

function randomCode(): string {
  // 9-stelliger, gut ablesbarer Code (Extension überträgt ihn automatisch;
  // als Fallback kann der User ihn auch abtippen).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 9; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 3)}-${out.slice(3, 6)}-${out.slice(6, 9)}`;
}
