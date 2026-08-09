"use server";

// Benachrichtigungs-Einstellungen des eingeloggten Kontos gegen den
// notification_settings-Slice (/api/v1/notification-settings). Scope kommt im
// Backend aus dem Token (eigene user_id) — hier wird nie eine Nutzer-ID
// mitgegeben (Wurzel 3/9).
//
// Der Contract ist der Katalog in
// apps/api/src/features/notification_settings/katalog.py: die Spaltennamen
// folgen strikt `<schluessel>_<kanal>`. Die UI erfindet KEINE eigene
// Kategorie-Liste, sondern rendert, was `GET ""` (NotificationOverview)
// zurückgibt — sonst laufen Migration, Schema und Oberfläche auseinander
// (Wurzel 4).
// Typen und die Kategorie-Liste liegen in `portal-benachrichtigungen-typen.ts`:
// ein `"use server"`-Modul darf nur async functions exportieren, ein `const`
// hier bricht den Produktionsbuild (siehe Kopf der Typen-Datei).
import { ApiError, api } from "@/lib/api";
import type { NotificationOverview } from "@/lib/portal-benachrichtigungen-typen";
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

/** Alle Kategorien mit Kanal-Zustand und Sperr-Information. */
export async function getBenachrichtigungen(): Promise<
  Ergebnis<NotificationOverview>
> {
  return call<NotificationOverview>("");
}

/**
 * Einzelne Präferenzen ändern (PATCH-Semantik: nur gesetzte Felder).
 * Schlüssel sind die Spaltennamen `<schluessel>_<kanal>` aus dem Katalog.
 * Pflicht-E-Mails erzwingt das Backend zurück auf „an" — die UI zeigt sie
 * deshalb gesperrt an, statt eine Änderung vorzutäuschen.
 */
export async function setzeBenachrichtigungen(
  patch: Record<string, boolean>,
): Promise<Ergebnis<Record<string, boolean>>> {
  return call<Record<string, boolean>>("", { method: "PATCH", body: patch });
}
