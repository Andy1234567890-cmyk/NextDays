// Data-Layer Benachrichtigungs-Einstellungen (Server Component) über den DAL.
// GET /notification-settings liefert die KATEGORIEN samt Kanal-Zustand — die UI
// pflegt bewusst KEINE eigene Kategorie-Liste, sonst laufen Backend und Frontend
// auseinander (Wurzel 4). Welche Kanäle eine Kategorie hat und welcher Schalter
// gesperrt ist, entscheidet allein der Server.
import { api, ApiError } from "./api-server";

/** Ein Kanal einer Kategorie. `aenderbar: false` = an und gesperrt (rechtlich
 *  nötige Mail, z. B. Richtlinien) — die UI zeigt ihn ausgegraut-an. */
export interface KanalInfo {
  kanal: "email" | "sms" | "phone";
  aktiv: boolean;
  aenderbar: boolean;
}

/** Eine Zeile der Benachrichtigungs-Liste. `tab` trennt Marketing („angebote")
 *  von Betrieb („konto"), `gruppe` bildet die Zwischenüberschriften. */
export interface KategorieInfo {
  schluessel: string;
  tab: "angebote" | "konto";
  gruppe: string;
  kanaele: KanalInfo[];
}

export interface NotificationOverview {
  kategorien: KategorieInfo[];
  marketing_unsubscribed_all: boolean;
}

/** Benachrichtigungs-Kategorien des eingeloggten Kontos (oder null bei
 *  fehlendem Zugriff — das UI zeigt dann eine Fehlermeldung, keinen
 *  Fantasie-Default). */
export async function getNotificationOverview(): Promise<NotificationOverview | null> {
  try {
    return await api<NotificationOverview>("/notification-settings");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Spaltenname im Backend: `<schluessel>_<kanal>` (siehe Migration 0225). */
export function spaltenName(schluessel: string, kanal: string): string {
  return `${schluessel}_${kanal}`;
}
