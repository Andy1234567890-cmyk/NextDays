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
