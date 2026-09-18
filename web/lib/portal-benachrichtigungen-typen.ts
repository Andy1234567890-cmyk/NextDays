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

// Die Typen leben seit dem 18.09.2026 in `benachrichtigungen-typen.ts` und
// werden hier nur weitergereicht: dieselbe Antwort des Servers wird jetzt an
// DREI Stellen gerendert (Eigentümer-Portal, eigene Konto-Seite, Nutzer-Seite
// des Betriebs). Drei Kopien derselben Form liefen beim nächsten Kanal
// auseinander (Wurzel 4) — der Katalog hat gerade erst `push` bekommen.
export type {
  KanalInfo,
  KategorieInfo,
  NotificationOverview,
} from "@/lib/benachrichtigungen-typen";

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
  // Ein FAMILIENMITGLIED wuenscht eine Sperrzeit und braucht die Zustimmung
  // des Eigentuemers (0389/0390). Die Meldung ging live schon hinaus
  // (`public_portal/familie.py`), der Schalter dazu war im Portal aber nicht
  // erreichbar — eine Kategorie, die man nicht abstellen kann, obwohl der
  // Katalog sie als abwaehlbar fuehrt.
  "block_freigabe",
  // Statuswechsel an einer beauftragten Dienstleistung (0330).
  "owner_service",
  "account_activity",
  "reminders",
  "messages",
];
