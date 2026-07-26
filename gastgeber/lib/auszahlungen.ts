// Auszahlungen an den Betrieb (Booking-Modell).
//
// Die Plattform hält das Geld bis zur ABREISE — nicht bis zum Zahlungseingang.
// Ein Storno vor der Auszahlung fließt gar nicht erst; einer danach wird als
// Verrechnungsposten von der nächsten Auszahlung einbehalten.
import { api } from "./api-server";

export type PayoutInterval = "daily" | "weekly" | "monthly";

export type PayoutStatus =
  | "scheduled"
  | "due"
  | "held"
  | "paid"
  | "withheld"
  | "failed";

export interface AuszahlungsEinstellung {
  interval: PayoutInterval;
  paused: boolean;
  paused_reason: string | null;
}

export interface AuszahlungsZeile {
  id: string;
  reservation_id: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  donation_cents: number;
  cohost_cents: number;
  net_amount_cents: number;
  currency: string;
  status: PayoutStatus;
  due_at: string;
  paid_at: string | null;
}

/** Ein Verrechnungsposten — wird von der nächsten Auszahlung einbehalten. */
export interface Verrechnungsposten {
  id: string;
  reservation_id: string | null;
  kind: "refund" | "chargeback" | "cancellation_fee" | "correction";
  amount_cents: number;
  settled_cents: number;
  currency: string;
  note: string | null;
  created_at: string;
}

export interface AuszahlungsSumme {
  currency: string;
  pending_amount_cents: number;
  paid_amount_cents: number;
  count: number;
}

export interface AuszahlungsUebersicht {
  settings: AuszahlungsEinstellung;
  summary: AuszahlungsSumme[];
  recent: AuszahlungsZeile[];
  adjustments: Verrechnungsposten[];
}

/**
 * Alles für die Auszahlungsansicht in einem Aufruf.
 *
 * Wirft nicht: Ein Ladefehler darf den Zahlungsbereich nicht blockieren — der
 * Reiter zeigt dann einen Hinweis statt die Seite scheitern zu lassen.
 */
export async function getAuszahlungsUebersicht(): Promise<AuszahlungsUebersicht | null> {
  try {
    return await api<AuszahlungsUebersicht>("/payouts", { cache: "no-store" });
  } catch {
    return null;
  }
}
