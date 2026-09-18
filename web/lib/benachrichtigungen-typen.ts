// Typen der Benachrichtigungs-Einstellungen — geteilt von Betriebs-Oberfläche
// (/konto/benachrichtigungen, /konto/nutzer/<id>/benachrichtigungen) und
// Eigentümer-Portal (/portal/benachrichtigungen).
//
// Diese Datei trägt BEWUSST kein `"use server"`: ein Server-Action-Modul darf
// ausschließlich async functions exportieren, sonst bricht der Produktionsbuild
// beim Sammeln der Seitendaten ("A 'use server' file can only export async
// functions, found object"). `tsc --noEmit` und ESLint sehen diesen Verstoß
// NICHT — nur der Build bei Coolify. Typen und Werte gehören deshalb hierher,
// die Actions nach `benachrichtigungen.ts`.
//
// Der Contract ist der Katalog in
// apps/api/src/features/notification_settings/katalog.py: die Spaltennamen
// folgen strikt `<schluessel>_<kanal>`. KEINE Oberfläche führt eine eigene
// Kategorie-Liste — sie rendern, was `NotificationOverview` liefert (Wurzel 4).

/** Ein Kanal einer Kategorie samt Zustand und ob er änderbar ist. */
export type KanalInfo = {
  /** email | sms | phone | push — welche, entscheidet der Katalog je Kategorie. */
  kanal: string;
  aktiv: boolean;
  /** false = Schalter ist an und gesperrt (vertraglich nötige Mail). */
  aenderbar: boolean;
};

export type KategorieInfo = {
  schluessel: string;
  /** angebote (Marketing) | konto (Betrieb) */
  tab: string;
  gruppe: string;
  kanaele: KanalInfo[];
};

export type NotificationOverview = {
  kategorien: KategorieInfo[];
  marketing_unsubscribed_all: boolean;
};

/**
 * Die Reihenfolge der Gruppen in der Betriebs-Oberfläche.
 *
 * Der Server liefert die Kategorien in Katalog-Reihenfolge; die ist historisch
 * gewachsen (neue Kategorien hängen hinten an) und darum keine gute Gliederung
 * für das Auge. Hier steht nur die REIHENFOLGE — welche Gruppen es gibt und
 * welche Kategorie in welcher hängt, bleibt Sache des Katalogs. Eine unbekannte
 * Gruppe landet hinten statt zu verschwinden (Wurzel 4/5: nichts still
 * unterschlagen).
 */
export const GRUPPEN_REIHENFOLGE: readonly string[] = [
  "aktivitaet",
  "nachrichten",
  "aufgaben",
  "personal",
  "erinnerungen",
  "konto",
  "insights",
  "hosting",
  "travel",
  "platform",
];

/** Die Kanäle in fester Spaltenordnung — E-Mail zuerst, es ist der Anlass. */
export const KANAL_REIHENFOLGE: readonly string[] = [
  "email",
  "push",
  "sms",
  "phone",
];

/** Gruppen nach `GRUPPEN_REIHENFOLGE` sortieren, Unbekanntes ans Ende. */
export function gruppenSortieren(gruppen: string[]): string[] {
  const rang = (g: string) => {
    const i = GRUPPEN_REIHENFOLGE.indexOf(g);
    return i === -1 ? GRUPPEN_REIHENFOLGE.length : i;
  };
  return [...gruppen].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
}

// Ein `kanaeleSortieren` stand hier bis zum 18.09.2026 und ist mit dem
// Spaltenraster entfallen: die Oberfläche geht nicht mehr die Kanäle EINER
// Kategorie durch, sondern die festen Spalten des Bereichs und fragt je Spalte,
// ob diese Kategorie sie kennt. Genau umgekehrt — und genau deshalb stehen die
// Schalter jetzt untereinander.
