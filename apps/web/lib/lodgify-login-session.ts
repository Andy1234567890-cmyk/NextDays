// Hält laufende Lodgify-Login-Vorgänge über zwei Schritte offen (E-Mail/Passwort
// → SMS-Code). Der Playwright-Browser muss zwischen beiden Requests am Leben
// bleiben, damit der 2FA-Code in dieselbe Sitzung eingegeben werden kann.
//
// In-Memory mit TTL. Single-Instance (Dev/aktueller Server) ausreichend; für
// Multi-Instanz-Prod müsste der Login-Schritt an dieselbe Instanz geroutet werden
// (Sticky) — bewusst dokumentiert. Sessions werden nach Abschluss/Timeout hart
// geschlossen (Browser beenden), damit kein Chromium leakt.
import type { Browser, Page } from "playwright-core";

export type LoginSession = {
  id: string;
  browser: Browser;
  page: Page;
  expires: number;
};

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min, um den SMS-Code einzugeben

const g = globalThis as unknown as {
  __lgLoginSessions?: Map<string, LoginSession>;
  __lgLoginSweeper?: ReturnType<typeof setInterval>;
};
const sessions = (g.__lgLoginSessions ??= new Map());

// Abgelaufene Sessions regelmäßig schließen (Browser beenden), damit kein
// headless-Chromium hängen bleibt.
if (!g.__lgLoginSweeper) {
  g.__lgLoginSweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (s.expires < now) {
        void s.browser.close().catch(() => {});
        sessions.delete(id);
      }
    }
  }, 30_000);
  // Sweeper darf den Prozess nicht am Beenden hindern.
  (g.__lgLoginSweeper as unknown as { unref?: () => void }).unref?.();
}

export function putLoginSession(browser: Browser, page: Page): string {
  const id = crypto.randomUUID();
  sessions.set(id, {
    id,
    browser,
    page,
    expires: Date.now() + SESSION_TTL_MS,
  });
  return id;
}

export function getLoginSession(id: string): LoginSession | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (s.expires < Date.now()) {
    void s.browser.close().catch(() => {});
    sessions.delete(id);
    return null;
  }
  // TTL beim Zugriff verlängern (der Kunde ist noch aktiv dabei).
  s.expires = Date.now() + SESSION_TTL_MS;
  return s;
}

/** Session schließen und Browser beenden (nach erfolgreichem Import oder Abbruch). */
export async function closeLoginSession(id: string): Promise<void> {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  try {
    await s.browser.close();
  } catch {
    // Browser evtl. schon zu — egal.
  }
}
