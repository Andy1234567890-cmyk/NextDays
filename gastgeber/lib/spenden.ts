// Spenden vom Auszahlungsanteil (Airbnb-Modell „Donate to Airbnb.org").
//
// Der Gastgeber legt EINEN Prozentsatz fest, der je Buchung von seinem Anteil
// abgeht. Die feste Plattform-Gebühr bleibt unberührt — die Spende kommt oben
// drauf, wie die Co-Gastgeber-Beteiligung.
import { api } from "./api-server";

export interface SpendenEmpfaenger {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
}

export interface SpendenEinstellung {
  /** Basispunkte (300 = 3 %). 0 = keine Spende eingerichtet. */
  share_bps: number;
  recipient_id: string | null;
  recipient_name: string | null;
  accepted_at: string | null;
  /** Echte Obergrenze nach Plattform-Gebühr und Beteiligungen. */
  max_share_bps: number;
  platform_fee_bps: number;
  /** Ohne verbundenes Auszahlungskonto ist Spenden nicht möglich. */
  payouts_ready: boolean;
}

export interface SpendenZeile {
  id: string;
  reservation_id: string;
  recipient_id: string;
  recipient_name: string | null;
  share_bps: number;
  gross_amount_cents: number;
  amount_cents: number;
  reversed_amount_cents: number;
  currency: string;
  status: "pending" | "collected" | "paid_out" | "reversed";
  created_at: string;
}

export interface SpendenSumme {
  currency: string;
  total_amount_cents: number;
  reversed_amount_cents: number;
  count: number;
}

export interface SpendenUebersicht {
  settings: SpendenEinstellung;
  recipients: SpendenEmpfaenger[];
  summary: SpendenSumme[];
  recent: SpendenZeile[];
}

/**
 * Alles für die Spenden-Ansicht in einem Aufruf.
 *
 * Wirft nicht: Ein Ladefehler darf den Zahlungsbereich nicht blockieren — der
 * Aufrufer zeigt den Reiter dann leer statt die ganze Seite scheitern zu
 * lassen.
 */
export async function getSpendenUebersicht(): Promise<SpendenUebersicht | null> {
  try {
    return await api<SpendenUebersicht>("/donations", { cache: "no-store" });
  } catch {
    return null;
  }
}
