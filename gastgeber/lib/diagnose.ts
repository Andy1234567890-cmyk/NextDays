// Diagnose-Freigaben des Kontos (Lesen).
//
// Der Support sieht technische Fehlerdaten dieses Kontos ausschließlich,
// solange hier eine Freigabe aktiv ist — der Kunde entscheidet, nicht wir.
import { api } from "./api-server";

export interface DebugSession {
  id: string;
  tenant_id: string | null;
  ticket_id: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  note: string | null;
  /** Läuft die Freigabe gerade? */
  aktiv: boolean;
}

/** Die eigenen Freigaben (neueste zuerst). */
export async function getDebugSessions(): Promise<DebugSession[]> {
  return api<DebugSession[]>("/diagnostics/debug", { cache: "no-store" });
}
