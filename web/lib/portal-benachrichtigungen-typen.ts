// Typen und Konstanten der Eigentümer-Benachrichtigungen.
//
// Diese Datei trägt BEWUSST kein `"use server"`: ein Server-Action-Modul darf
// ausschließlich async functions exportieren, sonst bricht der Produktionsbuild
// beim Sammeln der Seitendaten ("A 'use server' file can only export async
// functions, found object"). `tsc --noEmit` und ESLint sehen diesen Verstoß
// NICHT — nur `next build`. Werte (hier `PORTAL_KATEGORIEN`) gehören deshalb
// hierher, die Actions bleiben in `portal-benachrichtigungen.ts`.
//
// Der Contract ist der Katalog in
// apps/api/src/features/notification_settings/katalog.py: die Spaltennamen
// folgen strikt `<schluessel>_<kanal>`.

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
