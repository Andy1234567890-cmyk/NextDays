"use server";

// Benachrichtigungs-Einstellungen im PMS (Konto → Benachrichtigungen und
// Konto → Nutzer → <Person> → Benachrichtigungen) gegen den
// notification_settings-Slice (/api/v1/notification-settings).
//
// ZWEI Wege, und der Unterschied ist der Grund für zwei Funktionspaare:
//
// * `getEigene`/`setzeEigene` — ohne ID. Der Server nimmt die user_id aus dem
//   Token; ein Client kann sie nicht wählen (Wurzel 3).
// * `getFuerNutzer`/`setzeFuerNutzer` — MIT ID, für die Nutzerverwaltung. Der
//   Server verlangt dafür MANAGE_STAFF und scopt die ID auf den eigenen Tenant.
//   Hier eine ID mitzugeben ist also erlaubt, aber nie ausreichend — die
//   Oberfläche verlässt sich nicht darauf, dass sie nur eigene IDs anzeigt.
//
// Typen und Sortier-Hilfen liegen in `benachrichtigungen-typen.ts`: ein
// `"use server"`-Modul darf nur async functions exportieren, ein `const` hier
// bricht den Produktionsbuild (siehe Kopf der Typen-Datei).
import { ApiError, api } from "@/lib/api";
import type { NotificationOverview } from "@/lib/benachrichtigungen-typen";
import { currentToken } from "@/lib/session-token";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  pfad: string,
  opts: { method?: "GET" | "PATCH"; body?: unknown } = {},
): Promise<Ergebnis<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      data: await api<T>(`/notification-settings${pfad}`, { ...opts, token }),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Backend nicht erreichbar.",
    };
  }
}

/** Die eigenen Kategorien mit Kanal-Zustand und Sperr-Information. */
export async function getEigene(): Promise<Ergebnis<NotificationOverview>> {
  return call<NotificationOverview>("");
}

/**
 * Eigene Präferenzen ändern (PATCH-Semantik: nur gesetzte Felder).
 * Schlüssel sind die Spaltennamen `<schluessel>_<kanal>` aus dem Katalog.
 * Pflicht-E-Mails erzwingt das Backend zurück auf „an" — die Oberfläche zeigt
 * sie deshalb gesperrt, statt eine Änderung vorzutäuschen.
 */
export async function setzeEigene(
  patch: Record<string, boolean>,
): Promise<Ergebnis<Record<string, boolean>>> {
  return call<Record<string, boolean>>("", { method: "PATCH", body: patch });
}

/** Dieselbe Sicht für einen Nutzer des eigenen Betriebs (MANAGE_STAFF). */
export async function getFuerNutzer(
  userId: string,
): Promise<Ergebnis<NotificationOverview>> {
  return call<NotificationOverview>(`/nutzer/${userId}`);
}

/**
 * Präferenzen eines Nutzers des eigenen Betriebs ändern (MANAGE_STAFF).
 * Auch hier bleiben Pflicht-E-Mails an: der Verwaltungs-Weg ist kein
 * Schlupfloch um `email_pflicht`.
 */
export async function setzeFuerNutzer(
  userId: string,
  patch: Record<string, boolean>,
): Promise<Ergebnis<Record<string, boolean>>> {
  return call<Record<string, boolean>>(`/nutzer/${userId}`, {
    method: "PATCH",
    body: patch,
  });
}
