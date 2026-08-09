// Lesezugriffe des Backoffice auf die offiziellen Ankündigungen.
// Jeder dieser Endpunkte ist serverseitig durch CurrentPlatformAdmin bewacht;
// diese Datei ist reiner Transport (Muster: lib/backoffice.ts).
import { api } from "./api-server";

/** Redaktionelle Einordnung — steuert Pille/Farbe im Kundendashboard. */
export type AnkuendigungKategorie =
  | "neuerung"
  | "wartung"
  | "hinweis"
  | "wichtig";

export type AnkuendigungStatus = "entwurf" | "veroeffentlicht" | "archiviert";

export interface Ankuendigung {
  id: string;
  titel: string;
  /** Bereits serverseitig (nh3) bereinigt — nie der Rohtext des Redakteurs. */
  inhalt_html: string;
  kurztext: string | null;
  kategorie: AnkuendigungKategorie;
  /** true = unterbricht den Betrieb beim nächsten Login mit einem Dialog. */
  als_popup: boolean;
  status: AnkuendigungStatus;
  veroeffentlicht_am: string | null;
  gueltig_bis: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AnkuendigungListe {
  items: Ankuendigung[];
  total: number;
  /** Nur im Dashboard-Pfad gefüllt; im Backoffice immer 0. */
  ungelesen: number;
}

export const KATEGORIE_LABEL: Record<AnkuendigungKategorie, string> = {
  neuerung: "Neuerung",
  wartung: "Wartung",
  hinweis: "Hinweis",
  wichtig: "Wichtig",
};

export const STATUS_LABEL: Record<AnkuendigungStatus, string> = {
  entwurf: "Entwurf",
  veroeffentlicht: "Veröffentlicht",
  archiviert: "Zurückgezogen",
};

/** Alle Ankündigungen (neueste zuerst), inkl. Entwürfen.
 *  Bewusst ohne Statusfilter: der Backoffice-Endpunkt kennt keinen, und ein
 *  clientseitiger Filter wäre eine zweite Wahrheit über dieselbe Liste. */
export async function getAnkuendigungen(params?: {
  limit?: number;
  offset?: number;
}): Promise<AnkuendigungListe> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const suffix = q.toString() ? `?${q}` : "";
  return api<AnkuendigungListe>(`/platform/announcements${suffix}`, {
    cache: "no-store",
  });
}

/** Eine Ankündigung im Detail (Bearbeiten-Route). */
export async function getAnkuendigung(id: string): Promise<Ankuendigung> {
  return api<Ankuendigung>(`/platform/announcements/${id}`, {
    cache: "no-store",
  });
}

// === Übersetzungen (0347) ==================================================

/** Eine Fassung in EINER Sprache.
 *
 *  `geprueft` ist das tragende Feld: true heißt, ein Mensch hat sie korrigiert
 *  und verantwortet sie — kein automatischer Lauf fasst sie danach noch an.
 *  `veraltet` errechnet der Server aus dem Hash des Quelltextes; es steht
 *  bewusst nicht in der DB. */
export interface AnkuendigungFassung {
  sprache: string;
  titel: string;
  kurztext: string | null;
  /** Bereits serverseitig (nh3) bereinigt — auch die Antwort des
   *  Übersetzungsdienstes ist Fremd-Input und läuft durch dieselbe Allowlist. */
  inhalt_html: string;
  geprueft: boolean;
  geprueft_am: string | null;
  /** Das Original wurde geändert, seit diese Fassung entstand. */
  veraltet: boolean;
}

export interface FassungsUebersicht {
  items: AnkuendigungFassung[];
  /** Sprachen ohne Fassung. Kommt vom Server, damit die Sprachliste nicht ein
   *  zweites Mal im Frontend steht und beim Hinzufügen auseinanderläuft. */
  fehlend: string[];
  /** Geprüfte Fassungen, die nicht mehr zum aktuellen Original passen. Sie
   *  werden NICHT überschrieben — der Redakteur entscheidet. */
  veraltet: string[];
}

/** Die 24 EU-Amtssprachen mit ihrem deutschen Namen.
 *
 *  Reine ANZEIGE — die verbindliche Liste führt das Backend (0347-CHECK und
 *  `core.mail_sprache.SUPPORTED`). Welche Sprachen fehlen, rechnet deshalb der
 *  Server aus und nicht diese Map. Fehlt hier ein Code, zeigt die UI ihn roh
 *  an, statt zu crashen. */
export const SPRACH_NAME: Record<string, string> = {
  bg: "Bulgarisch",
  cs: "Tschechisch",
  da: "Dänisch",
  de: "Deutsch (Original)",
  el: "Griechisch",
  en: "Englisch",
  es: "Spanisch",
  et: "Estnisch",
  fi: "Finnisch",
  fr: "Französisch",
  ga: "Irisch",
  hr: "Kroatisch",
  hu: "Ungarisch",
  it: "Italienisch",
  lt: "Litauisch",
  lv: "Lettisch",
  mt: "Maltesisch",
  nl: "Niederländisch",
  pl: "Polnisch",
  pt: "Portugiesisch",
  ro: "Rumänisch",
  sk: "Slowakisch",
  sl: "Slowenisch",
  sv: "Schwedisch",
};

/** Sprachstand einer Ankündigung: vorhandene, fehlende, veraltete Fassungen. */
export async function getFassungen(id: string): Promise<FassungsUebersicht> {
  return api<FassungsUebersicht>(
    `/platform/announcements/${id}/uebersetzungen`,
    { cache: "no-store" },
  );
}
