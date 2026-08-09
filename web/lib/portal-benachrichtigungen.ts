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
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Ein Kanal einer Kategorie samt Zustand und ob er änderbar ist. */
export type KanalInfo = {
  kanal: string; // email | sms | phone
  aktiv: boolean;
  /** false = Schalter ist an und gesperrt (vertraglich nötige Mail). */
  aenderbar: boolean;
};

export type KategorieInfo = {
  schluessel: string;
  tab: string; // angebote | konto
  gruppe: string;
  kanaele: KanalInfo[];
};

export type NotificationOverview = {
  kategorien: KategorieInfo[];
  marketing_unsubscribed_all: boolean;
};

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

/**
 * Die Kategorien, die einen EIGENTÜMER betreffen — in dieser Reihenfolge.
 *
 * Der Auftrag nennt „Buchungseingang · Änderung · Storno". Der Backend-Katalog
 * bündelt genau diese drei in `owner_booking` (eigene Kategorie, weil der
 * EMPFÄNGER ein anderer ist als bei `listing_activity`: dort der Betrieb, hier
 * der Eigentümer). Es wird deshalb bewusst KEINE eigene Dreiteilung erfunden —
 * die UI zeigt, was serverseitig existiert (Wurzel 4).
 *
 * `listing_activity` steht hier NICHT: das ist die Objekt-Aktivität des
 * BETRIEBS. Die Marketing-Kategorien („Angebote und Updates") ebenfalls nicht —
 * die gehören in die Konto-Einstellungen des Betriebs.
 */
export const PORTAL_KATEGORIEN: readonly string[] = [
  // Buchung, Änderung, Storno am eigenen Objekt (E-Mail vertraglich Pflicht).
  "owner_booking",
  // Antwort der Verwaltung auf einen eigenen Sperr-Antrag (0332).
  "block_decision",
  // Statuswechsel an einer beauftragten Dienstleistung (0330).
  "owner_service",
  "account_activity",
  "reminders",
  "messages",
];
